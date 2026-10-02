import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { ResetPasswordForm } from '@/components/custom/reset-password-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.resetPassword');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/reset-password' },
    robots: { index: false, follow: false },
  };
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const t = await getTranslations('auth.resetPassword');
  const params = await searchParams;
  const token =
    typeof params.token === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(params.token)
      ? params.token
      : null;

  if (params.error || !token) {
    return (
      <AuthShell
        footer={
          <Link
            href="/forgot-password"
            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
          >
            {t('requestAgain')}
          </Link>
        }
      >
        <div className="mb-8 grid gap-2">
          <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('invalidTitle')}
          </h1>
          <p className="text-pretty text-body text-muted-foreground">{t('invalidBody')}</p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="mb-8 grid gap-2">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('title')}
        </h1>
        <p className="text-pretty text-body text-muted-foreground">{t('subtitle')}</p>
      </div>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
