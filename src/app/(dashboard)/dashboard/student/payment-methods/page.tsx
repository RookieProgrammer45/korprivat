//
// Student dashboard leaf that mounts the `<SavedMethodsPanel/>` island.
// The island fetches `/api/profile/payment-methods` (list) and
// `/api/profile/me` (manifest) on mount, so this page is composition-
// only — no `await prisma`, no `await fetch`. The (dashboard) layout
// already gates the page with `requireDashboardSession()` so the
// signed-out case redirects to `/login?next=…` automatically.
//
// The page exports `metadata` so the per-page <title> follows the
// locale-aware string the i18n key carries — the title bar gives the
// learner a stable, identifiable surface for the "saved method"
// affordance.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SavedMethodsPanel } from '@/components/custom/dashboard/saved-methods-panel';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.student.paymentMethods');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/student/payment-methods' },
    robots: { index: false, follow: false },
  };
}

export default async function StudentPaymentMethodsPage() {
  const session = await requireDashboardSession('/dashboard/student/payment-methods');
  if (session.role !== 'STUDENT') {
    redirect(dashboardPathFor(session.role));
  }
  const t = await getTranslations('dashboard.student.paymentMethods');
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <SavedMethodsPanel />
    </section>
  );
}
