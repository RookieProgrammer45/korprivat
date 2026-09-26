// @polsia:user-owned — POST /api/signup/complete, the server completion gate.
import 'server-only';
import { NextResponse } from 'next/server';
import { confirmedPhotoUrl } from '@/lib/business/photo-verification';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { SignupComplete, SignupCompleteResponse } from '@/lib/contracts/signup';
import { prisma } from '@/lib/db';
import { completeSignupHandshake } from '@/lib/email/onboarding';
import { requireAuth } from '@/lib/require-auth';
import { resolveStoredLearnerState } from '@/lib/signup-resume';
import { stateToRoute } from '@/lib/verification/state';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = SignupComplete.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: { next: 'Invalid redirect path.' } }, { status: 400 });
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true, dateOfBirth: true },
  });
  const role =
    profile?.role === 'INSTRUCTOR' || profile?.role === 'HANDLEDARE' ? profile.role : 'STUDENT';
  // School listings need a confirmed photo before the wizard can finish.
  // Learners and handledare can complete signup and add a photo later on /profile.
  if (role === 'INSTRUCTOR' && !(await confirmedPhotoUrl(user.id))) {
    return NextResponse.json({ errors: { photo: 'photo_confirmation_required' } }, { status: 409 });
  }
  if (role === 'INSTRUCTOR') {
    const license = await prisma.instructorLicense.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!license)
      return NextResponse.json({ errors: { license: 'license_required' } }, { status: 409 });
  }
  if (role === 'HANDLEDARE') {
    const clickwrap = await prisma.clickwrapAcceptance.findUnique({
      where: { userId: user.id },
      select: { termsVersion: true },
    });
    if (clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION) {
      return NextResponse.json({ errors: { clickwrap: 'clickwrap_required' } }, { status: 409 });
    }
  }
  const result = await completeSignupHandshake({
    userId: user.id,
    email: user.email,
    name: user.name,
    requestedRole: role,
  });
  // Learners: verification soft-gate via stateToRoute.
  // Instructors / handledare: handshake dashboardPath (maps role →
  // /dashboard/instructor|handledare). No /onboarding/instructor route exists.
  const to =
    role === 'STUDENT'
      ? stateToRoute(resolveStoredLearnerState(profile?.dateOfBirth ?? null))
      : (parsed.data.next ?? result.dashboardPath);
  return NextResponse.json(SignupCompleteResponse.parse({ to }));
}
