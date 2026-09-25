// @polsia:user-owned — POST /api/clickwrap
//                      GET  /api/clickwrap
//
// Handledare-only: dated, versioned acceptance of the handledare terms.
// One row per user (UserProfile won't grow because the userId @unique on
// ClickwrapAcceptance already gate-per-user). The wizard on /signup and the
// dashboard renewal card both POST this endpoint; the dashboard renewal
// card (and future audit surfaces) GET it to render the current state.
//
// POST layout (top-down):
//   1. requireAuth — 401 Response when no session.
//   2. parse JSON body — 400 with { errors: { form } } when malformed.
//   3. ClickwrapAccept.parse — 400 with { errors: { termsVersion } } when
//      missing/empty.
//   4. commit the HANDLEDARE role on UserProfile (after the auth-hook the
//      row exists with role DEFAULT STUDENT, so the dashboard router
//      would otherwise 404 the handledare). One-shot: we only flip when
//      the row is still STUDENT — leaving INSTRUCTOR alone if the same
//      user later re-attests with the handledare tier.
//   5. capture ip + ua — both optional, never reject the request on their
//      absence (operating behind a proxy may strip x-forwarded-for).
//   6. upsert ClickwrapAcceptance row keyed by userId — same-row
//      re-attestation updates the version stamp. Idempotent and
//      race-safe via the unique userId.
//   7. return 204 (no body) — the POST's only signal is "stored".
//
// GET layout:
//   1. requireAuth — 401 Response when no session.
//   2. findUnique by userId, select { termsVersion, acceptedAt }.
//   3. NextResponse.json(row ? CurrentAcceptance.parse(...) : null) —
//      `null` when no row exists so the client can distinguish "not yet
//      accepted" from "accepted at v0.0.0".

import 'server-only';
import { NextResponse } from 'next/server';
import { ClickwrapAccept, CurrentAcceptance } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function firstForwardedFor(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = ClickwrapAccept.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { termsVersion: 'termsVersion is required' } },
      { status: 400 },
    );
  }

  const acceptedAt = new Date();
  const ipAddress = firstForwardedFor(req.headers.get('x-forwarded-for'));
  const userAgent = req.headers.get('user-agent');

  // 4. Commit HANDLEDARE role on UserProfile. The after-hook seeds the
  // row with role=STUDENT by default; the clickwrap submission is the
  // first user-owned seam that can safely commit the role. We only flip
  // STUDENT → HANDLEDARE (never INSTRUCTOR → HANDLEDARE). updateMany
  // matches AT MOST one row (unique userId), so a race with a concurrent
  // clickwrap POST is safe. If the row is missing altogether (edge case:
  // after-hook disabled) we upsert it instead.
  try {
    const flipped = await prisma.userProfile.updateMany({
      where: { userId: user.id, role: 'STUDENT' },
      data: { role: 'HANDLEDARE' },
    });
    if (flipped.count === 0) {
      // Either the row is already INSTRUCTOR (we leave it alone) or it
      // doesn't exist (self-heal).
      await prisma.userProfile.upsert({
        where: { userId: user.id },
        create: { userId: user.id, role: 'HANDLEDARE' },
        update: {},
      });
    }
  } catch (_err) {
    // Role flip is best-effort; the clickwrap row below is still correct.
    // The dashboard-guard only requires the clickwrap row + role.
  }

  try {
    await prisma.clickwrapAcceptance.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        termsVersion: parsed.data.termsVersion,
        acceptedAt,
        ipAddress,
        userAgent,
      },
      update: {
        termsVersion: parsed.data.termsVersion,
        acceptedAt,
        ipAddress,
        userAgent,
      },
    });
  } catch (_err) {
    return NextResponse.json({ error: 'db_failed' }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const row = await prisma.clickwrapAcceptance.findUnique({
    where: { userId: user.id },
    select: { termsVersion: true, acceptedAt: true },
  });

  if (!row) {
    return NextResponse.json(null);
  }

  return NextResponse.json(
    CurrentAcceptance.parse({
      termsVersion: row.termsVersion,
      acceptedAt: row.acceptedAt.toISOString(),
    }),
  );
}
