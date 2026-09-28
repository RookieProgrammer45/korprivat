
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.providerActivation');
  return {
    title: t('pageTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardIndex() {
  const session = await requireDashboardSession('/dashboard');
  // Membership wins over UserProfile.role (school owners may also be instructors).
  redirect(await resolveDashboardHome(session.userId, session.role));
}
