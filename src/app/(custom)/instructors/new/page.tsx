// @polsia:user-owned — instructor self-onboarding page. Server Component
// shell that exports `metadata` and renders the
// `<InstructorOnboardingSurface />` client island; runtime session context and
// the onboarding flow are loaded through REST handlers.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { InstructorOnboardingSurface } from '@/components/custom/instructor-onboarding-surface';
import { Button } from '@/components/ui/button';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorOnboardingPage');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/instructors/new' },
    robots: { index: false, follow: false },
  };
}

export default async function InstructorSignupPage() {
  const t = await getTranslations('instructorOnboardingPage');

  return (
    <main className="container-page section">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <header className="flex flex-col gap-3 text-center sm:text-left">
          <p className="text-eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="max-w-xl text-body-lg text-muted-foreground">{t('lead')}</p>
          <div>
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="-ml-2 text-brand-700 hover:text-brand-700 dark:text-brand-300"
            >
              <Link href="/for-instructors">
                {t('back')}
                <span aria-hidden className="ml-1">
                  &rarr;
                </span>
              </Link>
            </Button>
          </div>
        </header>

        <InstructorOnboardingSurface />
      </div>
    </main>
  );
}
