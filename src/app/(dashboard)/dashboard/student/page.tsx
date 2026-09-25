// @polsia:user-owned — `/dashboard/student` server page (role stub).
//
// Server Component: greeting + the <StudentDashboard/> client island that
// fetches /api/bookings/me AND a sibling <RecommendedInstructors/>
// island that fetches /api/instructors/recommendations. No data-fetches
// in the page body — composition only.
//
// The recommendations island is hidden via `return null` when the
// learner has no category/city anchor yet (bookings = none). That is
// the brief's "hidden if no category/city set" affordance, so the page
// stays composition-only and never reads booking state itself.
//
// Role gate: only a Session whose `UserProfile.role === 'STUDENT'` renders
// here. A wrong-role deep-link (e.g. an INSTRUCTOR pasting the URL from a
// stale message) is redirected to the role-correct dashboard via
// `dashboardPathFor()`. The guard already fetched the role; we just branch
// on it before rendering.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RecommendedInstructors } from '@/components/custom/dashboard/recommended-instructors';
import { StudentDashboard } from '@/components/custom/dashboard/student-dashboard';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.student');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/student' },
    robots: { index: false, follow: false },
  };
}

export default async function StudentDashboardPage() {
  const session = await requireDashboardSession('/dashboard/student');
  if (session.role !== 'STUDENT') {
    redirect(dashboardPathFor(session.role));
  }
  const t = await getTranslations('dashboard.student');
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <StudentDashboard />
      <RecommendedInstructors />
    </section>
  );
}
