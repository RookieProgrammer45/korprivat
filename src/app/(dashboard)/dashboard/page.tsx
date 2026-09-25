// @polsia:user-owned — provider activation overview for marketplace roles.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CompletedLessonsCard } from '@/components/custom/dashboard/completed-lessons-card';
import { ProviderActivationKpi } from '@/components/custom/dashboard/provider-activation-kpi';
import { requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.providerActivation');
  return {
    title: t('pageTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardIndex() {
  const session = await requireDashboardSession('/dashboard');
  if (session.role === 'STUDENT') {
    redirect('/dashboard/student');
  }

  const t = await getTranslations('dashboard.providerActivation');

  return (
    <section className="grid gap-8">
      <header className="grid max-w-3xl gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('pageTitle')}
        </h1>
        <p className="text-body text-muted-foreground">{t('pageLead')}</p>
      </header>
      <div className="grid max-w-5xl gap-4 lg:grid-cols-2">
        <ProviderActivationKpi />
        <CompletedLessonsCard />
      </div>
    </section>
  );
}
