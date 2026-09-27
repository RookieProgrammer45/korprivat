// @polsia:user-owned — GET /api/signup/state, owner-scoped resume state.
import 'server-only';
import { NextResponse } from 'next/server';
import { photoState } from '@/lib/business/photo-verification';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { SignupPath, SignupState } from '@/lib/contracts/signup';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import {
  loadLearnerVerificationFacts,
  resolveLearnerStateFromFacts,
} from '@/lib/signup-resume';

export const dynamic = 'force-dynamic';

function parseSignupPath(value: string | null | undefined) {
  const parsed = SignupPath.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export async function GET(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true, signupPath: true },
  });
  const role =
    profile?.role === 'INSTRUCTOR' || profile?.role === 'HANDLEDARE' ? profile.role : 'STUDENT';
  const path = parseSignupPath(profile?.signupPath);
  const photo = await photoState(user.id);
  const [license, clickwrap] = await Promise.all([
    role === 'INSTRUCTOR'
      ? prisma.instructorLicense.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null,
    role === 'HANDLEDARE'
      ? prisma.clickwrapAcceptance.findUnique({
          where: { userId: user.id },
          select: { termsVersion: true },
        })
      : null,
  ]);
  const nextPrerequisite =
    role === 'INSTRUCTOR' && photo.status !== 'CONFIRMED'
      ? 'photo'
      : role === 'INSTRUCTOR' && !license
        ? 'license'
        : role === 'HANDLEDARE' && clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION
          ? 'clickwrap'
          : 'complete';

  let verificationState: SignupState['verificationState'];
  let diditSessionId: string | null | undefined;
  if (role === 'STUDENT') {
    const facts = await loadLearnerVerificationFacts(user.id);
    if (facts) {
      verificationState = resolveLearnerStateFromFacts(facts);
      diditSessionId = facts.diditSessionId;
    }
  }

  return NextResponse.json(
    SignupState.parse({
      role,
      path,
      photo,
      nextPrerequisite,
      emailVerified: Boolean(user.emailVerified),
      email: user.email,
      verificationState,
      diditSessionId,
    }),
  );
}
