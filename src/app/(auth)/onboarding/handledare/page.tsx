
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('onboarding.handledare');
  return {
    title: t('title'),
    alternates: { canonical: '/onboarding/handledare' },
    robots: { index: false, follow: false },
  };
}

export default async function HandledareOnboardingPage() {
  const t = await getTranslations('onboarding.handledare');
  return (
    <div className="grid gap-3">
      <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        {t('title')}
      </h1>
      <p className="text-pretty text-body text-muted-foreground">{t('body')}</p>
    </div>
  );
}
