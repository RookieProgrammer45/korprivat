//
// Server Component: greeting + host checklist + licence status banner +
// Connect / fee / policy / a single ProviderOperations mount + history.
//
// Role gate: only a session whose `UserProfile.role === 'INSTRUCTOR'`
// renders here.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { InstructorBookingHistory } from '@/components/custom/dashboard/instructor-booking-history';
import { InstructorHostChecklist } from '@/components/custom/dashboard/instructor-host-checklist';
import { InstructorReviewInbox } from '@/components/custom/dashboard/instructor-review-inbox';
import { ProviderOperations } from '@/components/custom/dashboard/provider-operations';
import {
  InstructorPayoutsCard,
  type InstructorPayoutsState,
} from '@/components/custom/instructor/instructor-payouts-card';
import { InstructorLicenseStatusBanner } from '@/components/custom/instructor-license-status-banner';
import { InstructorPayoutCard } from '@/components/custom/instructor-payout-card';
import { InstructorPolicyEditor } from '@/components/custom/instructor-policy-editor';
import { Button } from '@/components/ui/button';
import { dashboardPathFor, requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';
import { prisma } from '@/lib/db';
import { refreshInstructorConnectStatus } from '@/lib/payments/connect';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.instructor');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/instructor' },
    robots: { index: false, follow: false },
  };
}

function resolvePayoutsState(
  instructor: {
    stripeAccountId: string | null;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  },
  currentlyDue: string[],
): InstructorPayoutsState {
  if (!instructor.stripeAccountId) return 'A';
  if (instructor.chargesEnabled && instructor.payoutsEnabled) return 'C';
  if (!instructor.detailsSubmitted || currentlyDue.length > 0) return 'B';
  return 'D';
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

  let payoutsState: InstructorPayoutsState = 'A';
  const instructor = await prisma.instructor.findFirst({
    where: { userId: session.userId },
    select: {
      id: true,
      stripeAccountId: true,
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
    },
  });

  if (instructor) {
    let currentlyDue: string[] = [];
    try {
      const status = await refreshInstructorConnectStatus(instructor.id);
      currentlyDue = status.currentlyDue;
      const fresh = await prisma.instructor.findUnique({
        where: { id: instructor.id },
        select: {
          stripeAccountId: true,
          chargesEnabled: true,
          payoutsEnabled: true,
          detailsSubmitted: true,
        },
      });
      if (fresh) {
        payoutsState = resolvePayoutsState(fresh, currentlyDue);
      }
    } catch (error) {
      console.error('[dashboard/instructor] refreshInstructorConnectStatus failed', error);
      payoutsState = resolvePayoutsState(instructor, currentlyDue);
    }
  }

  const hasListing = Boolean(instructor);
  const connectReady = payoutsState === 'C';

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
          <Button asChild variant="outline">
            <Link href="/dashboard/instructor/revenue">{t('revenueCta')}</Link>
          </Button>
        </div>
      </header>
      <InstructorHostChecklist hasListing={hasListing} connectReady={connectReady} />
      <InstructorLicenseStatusBanner />
      {instructor ? (
        <div id="instructor-connect">
          <InstructorPayoutsCard state={payoutsState} />
        </div>
      ) : null}
      <InstructorPayoutCard />
      {hasListing ? <InstructorPolicyEditor /> : null}
      <ProviderOperations />
      <InstructorReviewInbox />
      <InstructorBookingHistory />
    </section>
  );
}
