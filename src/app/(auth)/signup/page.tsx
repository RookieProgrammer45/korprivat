// @polsia:user-owned — `/signup` page.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SignUpForm } from '@/components/custom/sign-up-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signUp');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/signup' },
    robots: { index: false, follow: false },
  };
}

function sanitizeNext(raw: string | undefined): string | undefined {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return undefined;
  return raw;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations('auth.signUp');
  const params = await searchParams;
  const next = sanitizeNext(params.next);

  return (
    <main className="auth-shell min-h-dvh flex items-center justify-center px-gutter py-section bg-[var(--background)]">
      <Card className="surface-panel relative w-full max-w-md border border-border bg-card shadow-sm lg:max-w-3xl">
        <CardHeader className="auth-card-header text-center pb-2">
          <div className="mx-auto mb-3 flex items-center justify-end">
            <LocaleSwitcher />
          </div>
          <CardTitle className="text-h4">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="mx-auto w-full max-w-md pt-4">
          <SignUpForm next={next} />
          <p className="mt-4 text-center text-small text-muted-foreground">
            {t('switchToSigninLead')}{' '}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
              className="text-brand-600 font-medium hover:text-brand-700 hover:underline underline-offset-2 transition-colors dark:text-brand-400"
            >
              {t('switchToSignin')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
