// @polsia:user-owned — POST /api/instructor-license/upgrade
//
// User-facing fallback for the handledare→trafiklärare role flip. The
// admin decision endpoint (`/api/admin/instructor-license-decision`) does
// the flip atomically when admin approves; this route is the idempotent
// backstop the handledare dashboard's upgrade island calls when GET shows
// status === VERIFIED but the user is still on the handledare dashboard
// (because the admin approved before they next refreshed, or because the
// licence row went VERIFIED before the role-flip code ever ran).
//
// Atomicity:
//   1. Open a $transaction — read the current InstructorLicense + UserProfile
//      states inside it so a concurrent admin decision can't flip the role
//      between read and write under us.
//   2. If the role is already INSTRUCTOR, commit a no-op and return
//      `alreadyUpgraded: true` so the dashboard island knows it's safe to
//      router.refresh() without re-running the side effect.
//   3. Otherwise update UserProfile.role to INSTRUCTOR.
//
// Returns:
//   200 InstructorLicenseUpgradeResponse on success (whether flipped or
//   already-flipped).
//   403 when the licence row's status !== 'VERIFIED' or the user's role
//   isn't HANDLEDARE (so an INSTRUCTOR clicking the button, or someone
//   whose licence was rejected, surfaces an error rather than a silent
//   no-op).

import 'server-only';
import { NextResponse } from 'next/server';
import { InstructorLicenseUpgradeResponse } from '@/lib/contracts/instructor-license';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (res) {
    if (res instanceof Response) return res;
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const upgradedAt = new Date();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [row, profile] = await Promise.all([
        tx.instructorLicense.findUnique({
          where: { userId: user.id },
          select: { status: true },
        }),
        tx.userProfile.findUnique({
          where: { userId: user.id },
          select: { role: true },
        }),
      ]);
      if (!row || row.status !== 'VERIFIED') {
        return { kind: 'not_ready' as const, status: row?.status ?? 'NONE' };
      }
      if (!profile) {
        return { kind: 'wrong_role' as const };
      }
      if (profile.role === 'INSTRUCTOR') {
        // Idempotent: the admin decision endpoint may have already flipped.
        return { kind: 'already_upgraded' as const };
      }
      if (profile.role !== 'HANDLEDARE') {
        return { kind: 'wrong_role' as const };
      }
      await tx.userProfile.update({
        where: { userId: user.id },
        data: { role: 'INSTRUCTOR' },
      });
      return { kind: 'flipped' as const };
    });

    if (result.kind === 'not_ready') {
      return NextResponse.json(
        { error: 'licence_not_verified', status: result.status },
        { status: 403 },
      );
    }
    if (result.kind === 'wrong_role') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    return NextResponse.json(
      InstructorLicenseUpgradeResponse.parse({
        userId: user.id,
        role: 'INSTRUCTOR',
        upgradedAt: upgradedAt.toISOString(),
        alreadyUpgraded: result.kind === 'already_upgraded',
      }),
    );
  } catch (_err) {
    return NextResponse.json({ error: 'upgrade_failed' }, { status: 500 });
  }
}
