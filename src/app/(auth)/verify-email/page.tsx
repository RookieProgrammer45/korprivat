
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { VerifyEmailFailed } from '@/components/custom/verification/verify-email-failed';
import { getSessionUser } from '@/lib/require-auth';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('verifyEmail');
  return {
    title: t('heading'),
    alternates: { canonical: '/verify-email' },
    robots: { index: false, follow: false },
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const params = await searchParams;
  const session = await getSessionUser();

  // Already verified (or just verified via better-auth redirect back here).
  if (session?.emailVerified && !params.error) {
    redirect('/signup?step=photo');
  }

  if (params.error || !params.token) {
    return (
      <AuthShell>
        <VerifyEmailFailed email={session?.email ?? null} />
      </AuthShell>
    );
  }

  // Hand off to better-auth; on success/error it redirects back to /verify-email
  // (success → session.emailVerified → redirect above on next load).
  const callbackURL = encodeURIComponent('/verify-email');
  redirect(
    `/api/auth/verify-email?token=${encodeURIComponent(params.token)}&callbackURL=${callbackURL}`,
  );
}
