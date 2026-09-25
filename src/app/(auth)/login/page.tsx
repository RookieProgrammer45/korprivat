// @polsia:user-owned — `/login` page.
//
// Server Component: reads `?next` server-side (no client counterpart needed)
// so a better-auth deep-link from the dashboard guard lands the user back
// where they came from after sign-in. The page itself only renders — the
// auth guard is light-touch on /login (no redirect of already-signed-in
// visitors; we want them to be able to switch accounts without first
// signing out cleanly).

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { SignInForm } from '@/components/custom/sign-in-form';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signIn');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/login' },
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations('auth.signIn');
  const params = await searchParams;
  // Sanitise `next`: only allow same-origin, '/' prefixed paths so an
  // attacker can't deep-link to an external host after auth.
  const next = sanitizeNext(params.next);

  return (
    <main className="auth-shell min-h-dvh flex items-center justify-center px-gutter py-section bg-[var(--background)]">
      <Card className="surface-panel relative w-full max-w-md border border-border bg-card shadow-sm">
        <CardHeader className="auth-card-header text-center pb-2">
          <div className="mx-auto mb-3 flex items-center justify-end">
            <LocaleSwitcher />
          </div>
          <CardTitle className="text-h4">{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <SignInForm next={next} />
          <p className="mt-4 text-center text-small text-muted-foreground">
            {t('switchToSignupLead')}{' '}
            <Link
              href="/signup"
              className="text-brand-600 font-medium hover:text-brand-700 hover:underline underline-offset-2 transition-colors dark:text-brand-400"
            >
              {t('switchToSignup')}
            </Link>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

function sanitizeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith('/')) return undefined;
  if (raw.startsWith('//')) return undefined;
  return raw;
}
