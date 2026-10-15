import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';
import { ensureSchoolSignupComplete } from '@/lib/signup-resume';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.providerActivation');
  return {
    title: t('pageTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardIndex() {
  const session = await requireDashboardSession('/dashboard');
  // Heal SCHOOL accounts that verified email but never got Org+Membership.
  const school = await ensureSchoolSignupComplete({
    id: session.userId,
    email: session.email,
    name: session.name,
  });
  if (school.ok) {
    redirect(school.next);
  }
  // Membership wins over UserProfile.role (school owners may also be instructors).
  redirect(await resolveDashboardHome(session.userId, session.role));
}
