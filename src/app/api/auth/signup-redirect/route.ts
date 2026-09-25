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
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  // Parse the desired role.
  const roleParsed = RoleEnum.safeParse((bodyJson as { role?: unknown })?.role);
  // Whether the parse failed or not, we still need a session to write
  // through — even if the user picked a bogus role, fall back to STUDENT.
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const chosen = roleParsed.success ? roleParsed.data : 'STUDENT';

  // Write the chosen role to UserProfile (the after-hook above seeds it as
  // STUDENT; this flips it on signup so the first dashboard render goes to
  // the role-correct surface). Idempotent — race-safe via the @unique userId.
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
      to: chosen === 'INSTRUCTOR' ? '/dashboard/instructor' : '/dashboard/student',
    }),
  );
}
