// @polsia:user-owned — `/signup` page.
//
// Auth shell owns brand + locale. SignUpForm owns the step contract:
// path → account → verifyEmail → (photo|license|handledare) as required.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { AuthShell } from '@/components/custom/auth-shell';
import { SignUpForm } from '@/components/custom/sign-up-form';
import { redirectLearnerAwayFromSignup } from '@/lib/signup-resume';

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

function resolveInitialPath(role: string | undefined): 'LEARNER' | 'INSTRUCTOR' | undefined {
  if (role === 'instructor') return 'INSTRUCTOR';
  return undefined;
}

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; role?: string; step?: string }>;
}) {
  const t = await getTranslations('auth.signUp');
  const params = await searchParams;
  const next = sanitizeNext(params.next);
  const initialPath = resolveInitialPath(params.role);
  const initialStep = params.step === 'photo' ? 'photo' : undefined;

  await redirectLearnerAwayFromSignup();

  return (
    <AuthShell
      footer={
        <>
          {t('switchToSigninLead')}{' '}
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
            className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
          >
            {t('switchToSignin')}
          </Link>
        </>
      }
    >
      <SignUpForm next={next} initialPath={initialPath} initialStep={initialStep} />
    </AuthShell>
  );
}
