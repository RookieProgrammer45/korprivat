//
// Server Component: reads `?next` server-side so a better-auth deep-link from
// the dashboard guard lands the user back where they came from after sign-in.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { SignInForm } from '@/components/custom/sign-in-form';

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
  const next = sanitizeNext(params.next);

  return (
    <AuthShell
      footer={
        <>
          {t('switchToSignupLead')}{' '}
          <Link
            href="/signup"
            className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
          >
            {t('switchToSignup')}
          </Link>
        </>
      }
    >
      <div className="mb-8 grid gap-2">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-pretty text-body text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SignInForm next={next} />
    </AuthShell>
  );
}

function sanitizeNext(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith('/')) return undefined;
  if (raw.startsWith('//')) return undefined;
  return raw;
}
