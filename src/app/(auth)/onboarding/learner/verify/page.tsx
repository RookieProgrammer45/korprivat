
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { LearnerVerifyClient } from '@/components/custom/verification/learner-verify-client';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/require-auth';
import {
  loadLearnerVerificationFacts,
  resolveLearnerStateFromFacts,
} from '@/lib/signup-resume';
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
  if (!facts?.claimedDob) {
    redirect('/signup');
  }

  const verificationState = resolveLearnerStateFromFacts(facts);

  // Already past Didit — leave this page (handles refresh after webhook).
  if (
    verificationState === 'ACTIVE' ||
    verificationState === 'HANDLEDARE_PENDING' ||
    verificationState === 'HANDLEDARE_EXPIRED' ||
    verificationState === 'BLOCKED_UNDERAGE' ||
    verificationState === 'SUSPENDED' ||
    verificationState === 'MANUAL_REVIEW'
  ) {
    redirect(stateToRoute(verificationState));
  }

  return (
    <AuthShell>
      <LearnerVerifyClient
        initialState={verificationState}
        initialSessionId={facts.diditSessionId}
      />
    </AuthShell>
  );
}
