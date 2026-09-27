import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AvailabilityEditor } from '@/components/custom/dashboard/availability-editor';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';
import { requireHandledareClickwrap } from '@/lib/handledare-clickwrap-guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.handledare.availability');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/handledare/availability' },
    robots: { index: false, follow: false },
  };
}

export default async function HandledareAvailabilityPage() {
  const session = await requireDashboardSession('/dashboard/handledare/availability');
  if (session.role !== 'HANDLEDARE') redirect(dashboardPathFor(session.role));
  const clickwrap = await requireHandledareClickwrap('/dashboard/handledare/availability');
  if (!clickwrap.isCurrent) redirect('/dashboard/handledare');
  const t = await getTranslations('dashboard.handledare.availability');
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight">{t('title')}</h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <AvailabilityEditor />
    </section>
  );
}
