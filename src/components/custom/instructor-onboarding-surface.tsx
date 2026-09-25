// @polsia:user-owned — client island for onboarding context and role gating.
'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { InstructorOnboardingForm } from '@/components/custom/instructor-onboarding-form';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  InstructorOnboardingContext,
  type InstructorOnboardingContext as OnboardingContext,
} from '@/lib/contracts/instructor-onboarding';

function isUnauthorized(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'error' in cause &&
    (cause as { error?: unknown }).error === 'Unauthorized'
  );
}

export function InstructorOnboardingSurface() {
  const router = useRouter();
  const t = useTranslations('instructorOnboardingPage');
  const [context, setContext] = useState<OnboardingContext | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/instructors/onboarding', { schema: InstructorOnboardingContext })
      .then((nextContext) => {
        if (!active) return;
        setContext(nextContext);
      })
      .catch((err: unknown) => {
        if (!active) return;
        if (err instanceof Error && isUnauthorized(err.cause)) {
          router.replace('/login?next=%2Finstructors%2Fnew');
          return;
        }
        setError(true);
      });

    return () => {
      active = false;
    };
  }, [router]);

  if (error) {
    return (
      <Card role="alert" className="border-destructive/40 bg-card shadow-sm">
        <CardContent className="pt-6 text-body text-destructive">{t('error')}</CardContent>
      </Card>
    );
  }

  if (!context) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="grid gap-4 pt-6">
          <Skeleton className="h-6 w-2/5" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (context.role === 'STUDENT') {
    return (
      <div className="rounded-lg border border-brand-500/40 bg-brand-100 p-4 text-small text-brand-700 dark:bg-brand-900 dark:text-brand-200">
        {t('roleMismatch.body', { role: t('roleMismatch.student') })}{' '}
        {t('roleMismatch.contactLead')}{' '}
        <a
          href="mailto:korprivat@polsia.app"
          className="underline underline-offset-2 hover:text-brand-800 dark:hover:text-brand-100"
        >
          korprivat@polsia.app
        </a>{' '}
        {t('roleMismatch.contactTail')}
      </div>
    );
  }

  return <InstructorOnboardingForm providerRole={context.role} />;
}
