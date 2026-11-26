// shell that exports `metadata` and renders the
// `<InstructorOnboardingSurface />` client island; runtime session context and
// the onboarding flow are loaded through REST handlers.

import type { Metadata } from 'next';
import { permanentRedirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('instructorOnboardingPage');
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { canonical: '/instructors/new' },
    robots: { index: false, follow: false },
  };
}

export default async function InstructorSignupPage() {
  permanentRedirect('/signup?role=school');
}
