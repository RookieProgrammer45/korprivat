
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.providerActivation');
  return {
    title: t('pageTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardIndex() {
  const session = await requireDashboardSession('/dashboard');
  // Role-correct leaf for every marketplace role (learner, school, handledare).
  redirect(dashboardPathFor(session.role));
}
