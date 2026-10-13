//
// Auth shell owns brand + locale. SignUpForm owns the step contract:
// path → account → verifyEmail → (photo|license|handledare) as required.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AlreadySignedIn } from '@/components/custom/already-signed-in';
import { AuthShell } from '@/components/custom/auth-shell';
import { SignUpForm } from '@/components/custom/sign-up-form';
import { loginHrefWithNext, sanitizeNext } from '@/lib/auth-next';
import { getSessionUser } from '@/lib/require-auth';
import { resolveSignedInSignup } from '@/lib/signup-resume';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.signUp');
  return {
    title: t('title'),
    description: t('subtitle'),
    alternates: { canonical: '/signup' },
    robots: { index: false, follow: false },
  };
}

function resolveInitialPath(
  role: string | undefined,
): 'LEARNER' | 'SCHOOL' | 'INSTRUCTOR' | undefined {
  if (role === 'instructor') return 'INSTRUCTOR';
  if (role === 'school') return 'SCHOOL';
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
  // Mid-flow photo/licence steps run while signed in — never show "Log in".
  const sessionUser = await getSessionUser();

  if (sessionUser) {
    const disposition = await resolveSignedInSignup(
      {
        id: sessionUser.id,
        email: sessionUser.email,
        name: sessionUser.name,
        emailVerified: Boolean(sessionUser.emailVerified),
      },
      next,
      initialPath,
    );
    if (disposition.kind === 'redirect') {
      redirect(disposition.to);
    }
    if (disposition.kind === 'already_signed_in') {
      return (
        <AuthShell>
          <AlreadySignedIn home={disposition.home} email={disposition.email} />
        </AuthShell>
      );
    }
  }

  return (
    <AuthShell
      footer={
        sessionUser ? undefined : (
          <>
            {t('switchToSigninLead')}{' '}
            <Link
              href={loginHrefWithNext(next)}
              className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
            >
              {t('switchToSignin')}
            </Link>
          </>
        )
      }
    >
      <SignUpForm next={next} initialPath={initialPath} initialStep={initialStep} />
    </AuthShell>
  );
}
