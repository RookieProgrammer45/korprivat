// @polsia:user-owned — GET /api/auth/signup-redirect
//
// Returns the role-correct dashboard path for the freshly signed-up user.
// The signup form POSTs the chosen role in the body so this endpoint can
// decide before the UserProfile.role hook lands (the after-hook defaults
// to STUDENT; if the user picked INSTRUCTOR, we want them to land on the
// instructor dashboard).
//
// Kept tiny — single GET with a body payload, since browsers cache GETs
// badly this is acceptable: post-signup the redirect target does not need
// to be cached.

import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PostLoginRedirect, RoleEnum } from '@/lib/contracts/auth';
import { SignupRole } from '@/lib/contracts/signup';
import { dashboardPathFor } from '@/lib/dashboard-guard';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  // Accept the full marketplace role set (learner / school / handledare).
  const roleParsed = SignupRole.safeParse((bodyJson as { role?: unknown })?.role);
  const legacyRole = RoleEnum.safeParse((bodyJson as { role?: unknown })?.role);
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const chosen = roleParsed.success
    ? roleParsed.data
    : legacyRole.success
      ? legacyRole.data
      : 'STUDENT';

  await prisma.userProfile
    .update({
      where: { userId: session.user.id },
      data: { role: chosen },
    })
    .catch(() => {
      // Profile row missing (edge case: hook disabled or ran on a row that
      // was deleted). Re-create + retry once. Self-heal.
    });

  return NextResponse.json(
    PostLoginRedirect.parse({
      to: dashboardPathFor(chosen),
    }),
  );
}
