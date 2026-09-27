//
// Admin-only endpoint that flips an InstructorLicense row's status to one
// of {VERIFIED, REJECTED} (writes `verifiedAt` + `verifiedByEmail` + an
// optional rejection reason) and — when the transition is a
// HANDLEDARE→INSTRUCTOR upgrade — does the role-flip + fires the welcome
// email atomically with the licence update.
//
// Atomicity (3 pieces, in order):
//   1. $transaction — update the InstructorLicense row + update the
//      UserProfile.role when applicable. Either both commit or neither
//      does (the licence row's state and the user's role stay coherent).
//   2. Email: `sendEmail` runs OUTSIDE the transaction. A proxy hiccup
//      must NOT roll back the role-flip the user earned (we accept the
//      admin confirms the row in the table; the email is a courtesy).
//      Failures are warned to stderr and swallowed so the route returns
//      200 regardless.
//
// Idempotency:
//   - VERIFIED on an already-VERIFIED row: a no-op write (no audit spam),
//     no re-flip (role already INSTRUCTOR), no re-email.
//   - VERIFIED on a row whose user is not HANDLEDARE: write + audit, no
//     role flip (already INSTRUCTOR or STUDENT).
//   - VERIFIED on a HANDLEDARE user: write + flip + email.
//
// Returns:
//   200 OK with a small { ok: true, userId, status } envelope.
//   403 when the caller is not an admin.
//   400 on a body that fails InstructorLicenseAdminDecision validation.
//   404 when no InstructorLicense row matches that userId.
//   500 on a tx failure.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { InstructorLicenseAdminDecision } from '@/lib/contracts/instructor-license';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { instructorUpgradeApprovedEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const body = await req.json().catch(() => null);
  const parsed = InstructorLicenseAdminDecision.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const { userId, status, rejectionReason } = parsed.data;
  if (status === 'REJECTED' && !(rejectionReason && rejectionReason.trim().length > 0)) {
    return NextResponse.json({ error: 'rejection_reason_required' }, { status: 400 });
  }

  const verifiedAt = new Date();
  const session = await auth.api.getSession({ headers: await headers() });
  const verifiedByEmail = session?.user?.email ?? null;

  try {
    const decision = await prisma.$transaction(async (tx) => {
      const row = await tx.instructorLicense.findUnique({
        where: { userId },
        select: { status: true },
      });
      if (!row) {
        return { kind: 'not_found' as const };
      }
      const profile = await tx.userProfile.findUnique({
        where: { userId },
        select: { role: true },
      });

      await tx.instructorLicense.update({
        where: { userId },
        data: {
          status,
          verifiedAt,
          verifiedByEmail,
          rejectionReason: status === 'REJECTED' ? (rejectionReason ?? null) : null,
        },
      });

      // Only flip role on a fresh VERIFIED where the user is still
      // HANDLEDARE — re-verifications on an already-INSTRUCTOR user are
      // no-ops.
      const flipping = status === 'VERIFIED' && profile?.role === 'HANDLEDARE';
      if (flipping) {
        await tx.userProfile.update({
          where: { userId },
          data: { role: 'INSTRUCTOR' },
        });
      }
      return {
        kind: 'ok' as const,
        flipped: flipping,
        fromRole: profile?.role ?? null,
        verifiedByEmail,
      };
    });

    if (decision.kind === 'not_found') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // Email step — only on a HANDLEDARE→INSTRUCTOR transition (mirrors
    // the invite / re-verification split rules). Fetch the User row by id
    // (User is framework-owned; can't include it via Prisma @relation) so
    // we can stamp the recipient's real email + name.
    if (decision.flipped) {
      try {
        const dbUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, name: true },
        });
        if (dbUser?.email) {
          await sendEmail({
            to: dbUser.email,
            ...instructorUpgradeApprovedEmail({
              name: dbUser.name ?? 'driver',
              dashboardUrl: '/dashboard/instructor',
            }),
          });
        }
      } catch {
        // Don't roll back the flip — swallow + continue. Admin sees the
        // row update regardless; an email retry sits on a future cron.
      }
    }

    return NextResponse.json({
      ok: true,
      userId,
      status,
      flipped: decision.flipped,
      verifiedByEmail: decision.verifiedByEmail,
    });
  } catch (_err) {
    return NextResponse.json({ error: 'decision_failed' }, { status: 500 });
  }
}
