//
// Both the email-signup `POST /api/auth/welcome` route and the social-signup
// `POST /api/auth/social-role` route need the same per-user intro work after
// the User row is created: dedup'd welcome email, and (only on the FIRST
// handshake for a brand-new account) the role commit when the user picked
// INSTRUCTOR.
//
// Centralising the work here keeps the two routes in lock-step — the existing
// email flow's idempotency on `UserProfile.welcomeSentAt` is preserved by
// construction (same `where: { userId, welcomeSentAt: null }` shape as the
// inline call it replaces), and the role commit is tied to the welcome
// dedup so returning social signins do NOT clobber an existing INSTRUCTOR
// role with the OAuth callbackURL's STUDENT default.

import 'server-only';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { signedUpWelcomeEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

export interface CompleteSignupHandshakeInput {
  userId: string;
  // email + name come from the session.user payload — call sites pass them
  // in so the helper doesn't have to refetch the User row (which would be
  // a redundant round trip: every caller already has a getSession result
  // that returned the user).
  email: string;
  name: string | null | undefined;
  // The role the user picked on /signup. Optional because the WELCOME
  // route hands the role decision off to /api/auth/signup-redirect (which
  // commits the role to the row BEFORE this route reads it back) — so
  // the welcome route effectively re-uses whatever's already on the row.
  // Required on the SOCIAL sign-up path (no signup-redirect happened),
  // since the OAuth callbackURL is the ONLY place the role is carried.
  requestedRole?: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';
}

export interface CompleteSignupHandshakeResult {
  dashboardPath: string;
  // True iff this call ACTUALLY dispatched the welcome. Callers can use
  // this for telemetry, but the route handlers themselves treat both
  // branches as success — the UserProfile row is the source of truth, not
  // the email side effect.
  welcomeSent: boolean;
}

function dashboardPathFor(role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE'): string {
  // Same-origin relative so the link works on every deployed host
  // (*.polsia.app, custom brand domains) without baking a baseURL in.
  if (role === 'INSTRUCTOR') return '/dashboard/instructor';
  if (role === 'HANDLEDARE') return '/dashboard/handledare';
  return '/dashboard/student';
}

function resolveOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}

// Race-safe via the unique userId on UserProfile:
//   - role commit: tied to the welcome dedup. On a brand-new signup the
//     after-hook already created the row with role DEFAULT STUDENT; we
//     flip it to the requested role when welcomeSentAt is null. On a
//     returning social signin (or a stray re-fire of welcome) the
//     dedup branch leaves the existing role untouched.
//   - welcome dedup: the WHERE clause `welcomeSentAt: null` matches AT
//     MOST one row and only the FIRST concurrent caller transitions it
//     from null to now(); strict ordering preserved.
export async function completeSignupHandshake(
  input: CompleteSignupHandshakeInput,
): Promise<CompleteSignupHandshakeResult> {
  const { userId, email, name, requestedRole } = input;

  // 1. Self-heal a missing UserProfile row (the after-hook should have
  // created it; manual imports / hook-disabled dev are the edge cases).
  // On insert we seed STUDENT — the role commit in step 3 will flip it
  // to requestedRole if appropriate. On update we don't touch role.
  await prisma.userProfile
    .upsert({
      where: { userId },
      create: { userId, role: 'STUDENT' },
      update: {},
    })
    .catch(() => {
      // Never fail the handshake on a missing profile.
    });

  // 2. Race-safe welcome dedup + role commit, all gated on the FIRST
  // transition. We use updateMany on the same predicate so the role is
  // committed inline with the welcomeSentAt stamp — preventing a
  // returning social signin from clobbering an existing INSTRUCTOR's
  // role with the STUDENT default on the OAuth callbackURL.
  const claimed = await prisma.userProfile.updateMany({
    where: { userId, welcomeSentAt: null },
    data: {
      welcomeSentAt: new Date(),
      ...(requestedRole ? { role: requestedRole } : {}),
    },
  });

  // Compute the return value's dashboardPath from the role that's now
  // valid: either the requestedRole (a fresh signup that wrote it), or
  // what the row already had (welcomeSentAt was already set, so we
  // skipped the write branch).
  let effectiveRole: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE' = 'STUDENT';
  if (requestedRole && claimed.count > 0) {
    effectiveRole = requestedRole;
  } else {
    const existing = await prisma.userProfile
      .findUnique({ where: { userId }, select: { role: true } })
      .catch(() => null);
    effectiveRole =
      existing?.role === 'INSTRUCTOR'
        ? 'INSTRUCTOR'
        : existing?.role === 'HANDLEDARE'
          ? 'HANDLEDARE'
          : 'STUDENT';
  }

  if (claimed.count === 0) {
    return { dashboardPath: dashboardPathFor(effectiveRole), welcomeSent: false };
  }

  const fallbackName = name?.trim() || email;
  const dashboardUrl = `${resolveOrigin()}${dashboardPathFor(effectiveRole)}`;

  // First-time send. Swallow proxy errors so a flaky email transport
  // doesn't block the user from their dashboard — the welcomeSentAt
  // stamp is set, so a future retry against the same record stays a
  // no-op.
  await sendEmail({
    to: email,
    ...signedUpWelcomeEmail({ name: fallbackName, role: effectiveRole, dashboardUrl }),
  }).catch(() => {
    // Flag is set; admin-side resend out of scope for now.
  });

  return { dashboardPath: dashboardPathFor(effectiveRole), welcomeSent: true };
}
