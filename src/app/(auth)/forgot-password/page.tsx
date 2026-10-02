import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { ForgotPasswordForm } from '@/components/custom/forgot-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.forgotPassword');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/forgot-password' },
    robots: { index: false, follow: false },
  };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations('auth.forgotPassword');

  return (
    <AuthShell
      footer={
        <>
          {t('backLead')}{' '}
          <Link
            href="/login"
            className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
          >
            {t('backToLogin')}
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
      <ForgotPasswordForm />
    </AuthShell>
  );
}
