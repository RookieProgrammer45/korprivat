// @polsia:user-owned — POST /api/auth/social-role
//
// Post-OAuth-callback handshake for Google + Facebook sign-in.
//
// better-auth's framework catch-all handles the consent + provider
// exchange; once the social callback lands, the user is signed in but the
// UserProfile role is still the after-hook's default STUDENT. The role
// choice made on /signup (wired through the OAuth `callbackURL` by the
// `<SocialAuthButtons>` island) is in the search params, NOT in the
// better-auth session — so we need a server hop to commit it.
//
// This route:
//   1. requires an in-progress session — the social provider's callback
//      has set it; if it's missing, the OAuth flow didn't finish.
//   2. parses `{ role, next }` from the body — `role` came from the
//      callbackURL's search params (set by the button click), `next` is
//      optional and a leading-slash same-origin path.
//   3. calls completeSignupHandshake (idempotent role flip + dedup'd
//      welcome) — same code path as the email signup flow, just without
//      the session-email-match gate (the body has no email because the
//      social role was chosen by the user on /signup, not re-typed in a
//      form).
//   4. returns the role-correct dashboard path so the client can pop the
//      redirect on success.

import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PostLoginRedirect, SocialRoleRequest } from '@/lib/contracts/auth';
import { completeSignupHandshake } from '@/lib/email/onboarding';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = SocialRoleRequest.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ errors: { form: 'Invalid request' } }, { status: 400 });
  }
  const { role: requestedRole, next } = parsed.data;

  // Session gate — Google and Facebook both set a session cookie by the
  // time we get here. If the session is missing, the OAuth flow either
  // aborted or the cookie was dropped; either way the user can't
  // continue. Return 401 so the client island surfaces a localized
  // retry rather than a confusing redirect to /dashboard.
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await completeSignupHandshake({
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    requestedRole,
  });

  // Prefer the explicit `next` hint if it was provided — let a deep-linked
  // user get back to wherever they came from — otherwise land on the
  // role-correct dashboard. Both are leading-slash same-origin paths so a
  // client bug can't leak to an external origin.
  const target = next ?? result.dashboardPath;

  return NextResponse.json(PostLoginRedirect.parse({ to: target }));
}
