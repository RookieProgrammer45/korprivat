//
// Read-only view of every booking the signed-in learner owns —
// past and upcoming. Sits inside the existing (dashboard) layout so the
// role-aware nav and the layout-level session guard already cover it; this
// page composes the STUDENT branch (`session.role === 'STUDENT'` check
// redirects a wrong-role deep-link to the role-correct dashboard) and a
// single client island that fetches `/api/bookings/me/history`.
//
// composition-only: no `await prisma`, no `await fetch`, no Server Action
// here — all data flows through the /api handler behind the island.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { StudentBookingHistory } from '@/components/custom/dashboard/student-booking-history';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.student.history');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/student/bookings' },
    robots: { index: false, follow: false },
  };
}

export default async function StudentBookingsPage() {
  const session = await requireDashboardSession('/dashboard/student/bookings');
  if (session.role !== 'STUDENT') {
    redirect(dashboardPathFor(session.role));
  }
  const t = await getTranslations('dashboard.student.history');
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <StudentBookingHistory />
    </section>
  );
}
