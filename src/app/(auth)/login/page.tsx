//
// Server Component: reads `?next` server-side so a better-auth deep-link from
// the dashboard guard lands the user back where they came from after sign-in.

import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { RotatingTitle } from '@/components/custom/animated-title';
import { AuthSchoolCarousel } from '@/components/custom/auth-school-carousel';
import { AuthShell } from '@/components/custom/auth-shell';
import { SignInForm } from '@/components/custom/sign-in-form';
import { sanitizeNext, signupHrefWithNext } from '@/lib/auth-next';

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
  const hero = await getTranslations('publicHome.hero');
  const params = await searchParams;
  const next = sanitizeNext(params.next);
  const headlines = [
    hero('titleSchool'),
    hero('titleDealer'),
    hero('titleParts'),
    hero('titleInspection'),
    hero('titleTires'),
    hero('titleTaxi'),
    hero('titleLeasing'),
    hero('titleParking'),
  ];

  return (
    <AuthShell
      visual={<AuthSchoolCarousel />}
      footer={
        <>
          {t('switchToSignupLead')}{' '}
          <Link
            href={signupHrefWithNext(next)}
            className="font-medium text-brand-600 underline-offset-2 transition-colors hover:text-brand-700 hover:underline dark:text-brand-400"
          >
            {t('switchToSignup')}
          </Link>
        </>
      }
    >
      <div className="mb-8 grid gap-3">
        <h1 className="text-caption font-medium text-muted-foreground">{t('title')}</h1>
        <div aria-hidden="true">
          <RotatingTitle
            as="p"
            lines={headlines}
            className="min-h-[3.2em] font-display text-balance text-3xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-4xl"
          />
        </div>
        <p className="text-pretty text-body text-muted-foreground">{t('subtitle')}</p>
      </div>
      <SignInForm next={next} />
    </AuthShell>
  );
}
