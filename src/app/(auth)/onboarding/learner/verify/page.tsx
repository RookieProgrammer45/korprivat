import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { LearnerVerifyDobStep } from '@/components/custom/verification/learner-verify-dob-step';
// biome-ignore lint/style/noRestrictedImports: legacy server page - DB read predates the route-handler rule; refactor pending
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/require-auth';
import { loadLearnerVerificationFacts, resolveLearnerStateFromFacts } from '@/lib/signup-resume';
import { stateToRoute } from '@/lib/verification/state';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding.verify');
  return {
    title: t('heading'),
    alternates: { canonical: '/onboarding/learner/verify' },
    robots: { index: false, follow: false },
  };
}

export default async function LearnerVerifyPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/signup');
  }
  if (!user.emailVerified) {
    redirect('/signup');
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'STUDENT') {
    redirect('/signup');
  }

  const facts = await loadLearnerVerificationFacts(user.id);

  // OAuth learners without a claimed DOB still collect it here. Didit ID
  // verification is not part of the workflow right now.
  if (!facts?.claimedDob) {
    return <LearnerVerifyDobStep />;
  }

  redirect(stateToRoute(resolveLearnerStateFromFacts(facts)));
}
