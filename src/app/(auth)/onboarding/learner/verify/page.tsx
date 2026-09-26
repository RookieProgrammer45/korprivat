// @polsia:user-owned — Didit in progress (DIDIT_PENDING).

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding.verify');
  return {
    title: t('title'),
    alternates: { canonical: '/onboarding/learner/verify' },
    robots: { index: false, follow: false },
  };
}

export default async function LearnerVerifyPage() {
  const t = await getTranslations('onboarding.verify');
  return (
    <AuthShell>
      <div className="grid gap-3">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-pretty text-body text-muted-foreground">{t('body')}</p>
      </div>
    </AuthShell>
  );
}
