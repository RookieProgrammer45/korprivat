//
// Server Component: greeting + a "Manage availability" CTA + the
// <InstructorLicenseStatusBanner/> client island, which fetches the
// review status of the instructor's uploaded driving licence and branches
// on it: VERIFIED → the real instructor dashboard; NONE/PENDING → the
// pending-review empty state; REJECTED → the rejection card. No
// data-fetches in the page body — the licence status comes from the
// island's GET /api/instructor-license.
//
// Role gate: only a session whose `UserProfile.role === 'INSTRUCTOR'`
// renders here. A wrong-role deep-link is redirected to the role-correct
// dashboard via `dashboardPathFor()`. The guard already fetched the role.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InstructorBookingHistory } from '@/components/custom/dashboard/instructor-booking-history';
import { ProviderOperations } from '@/components/custom/dashboard/provider-operations';
import { InstructorLicenseStatusBanner } from '@/components/custom/instructor-license-status-banner';
import { InstructorPayoutCard } from '@/components/custom/instructor-payout-card';
import { Button } from '@/components/ui/button';
import { dashboardPathFor, requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.instructor');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/instructor' },
    robots: { index: false, follow: false },
  };
}

export default async function InstructorDashboardPage() {
  const session = await requireDashboardSession('/dashboard/instructor');
  const home = await resolveDashboardHome(session.userId, session.role);
  if (home !== '/dashboard/instructor') {
    redirect(home);
  }
  if (session.role !== 'INSTRUCTOR') {
    redirect(dashboardPathFor(session.role));
  }
  const t = await getTranslations('dashboard.instructor');
  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard/instructor/availability">{t('availabilityCta')}</Link>
          </Button>
        </div>
      </header>
      <InstructorLicenseStatusBanner />
      <InstructorPayoutCard />
      <ProviderOperations />
      <InstructorBookingHistory />
    </section>
  );
}
