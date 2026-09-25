// @polsia:user-owned — POST /api/auth/welcome
//
// Single signup-time welcome email. The signup form fires this AFTER better-
// auth's signUp.email resolves and the session cookie is set: idempotent —
// once per (User.id). The route exists so the welcome send NEVER ships from
// the client (the email proxy is server-only) and cannot be triggered twice
// for the same account.
//
// Gate stack (top-down, all must pass):
//   1. body must parse as { email } matching the session's email
//   2. user has a UserProfile row
//   3. UserProfile.welcomeSentAt is null → set it AND send the email
//      > non-null → return 204 without sending (idempotent re-call from a
//        page reload, dev-server retry, or double-submit)

import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { RoleEnum, WelcomeRequest } from '@/lib/contracts/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { signedUpWelcomeEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

function dashboardUrlFor(role: 'STUDENT' | 'INSTRUCTOR'): string {
  // Same-origin relative so the link works on every deployed host
  // (*.polsia.app, custom brand domains) without baking a baseURL in.
  return role === 'INSTRUCTOR' ? '/dashboard/instructor' : '/dashboard/student';
}

function resolveOrigin(): string {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
}

export async function POST(req: Request) {
  // 1. parse body — soft-400 if the shape is wrong.
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsedBody = WelcomeRequest.safeParse(bodyJson);
  if (!parsedBody.success) {
    return NextResponse.json({ errors: { email: 'Enter a valid email' } }, { status: 400 });
  }
  const bodyEmail = parsedBody.data.email.trim().toLowerCase();

  // 2. session — must be present AND its email must match what the form posted.
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const sessionEmail = session.user.email.trim().toLowerCase();
  if (sessionEmail !== bodyEmail) {
    return NextResponse.json(
      { errors: { email: 'Email does not match the signed-in account' } },
      { status: 400 },
    );
  }

  // 3. profile + idempotency — race-safe: a second concurrent request hits
  // the `where: { welcomeSentAt: null }` and matches no rows → no-op 204.
  // We don't strictly need this to be a transaction because:
  //   - welcomeSentAt is only ever set, never cleared
  //   - the email send itself is a no-op for non-recipients
  // Simpler form: the unique userId on UserProfile already serialises per-user.
  const result = await prisma.userProfile.updateMany({
    where: { userId: session.user.id, welcomeSentAt: null },
    data: { welcomeSentAt: new Date() },
  });

  if (result.count === 0) {
    // Already sent (or profile didn't exist then we created without writing
    // welcomeSentAt). Either way, do not re-send.
    return new NextResponse(null, { status: 204 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { role: true },
  });
  const role = profile?.role ? RoleEnum.parse(profile.role) : 'STUDENT';
  const name = session.user.name?.trim() || sessionEmail;

  const origin = resolveOrigin();
  const dashboardUrl = `${origin}${dashboardUrlFor(role)}`;

  // Fire-and-best-effort: if the proxy is unreachable in the sandbox the
  // welcomeSentAt flag stays set, which prevents a retry storm on the next
  // reload — but a fresh sign-up attempt (new email) still works. Errors are
  // swallowed so a 502 from the proxy doesn't fail the call.
  await sendEmail({
    to: sessionEmail,
    ...signedUpWelcomeEmail({ name, role, dashboardUrl }),
  }).catch(() => {});

  return new NextResponse(null, { status: 204 });
}
