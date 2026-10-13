//
// Server Component: greeting + the <StudentDashboard/> client island that
// fetches /api/bookings/me AND a sibling <RecommendedInstructors/>
// island that fetches /api/instructors/recommendations. No data-fetches
// in the page body — composition only.
//
// Role gate: only a Session whose `UserProfile.role === 'STUDENT'` renders
// here. Didit identity verification is not part of this dashboard.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RecommendedInstructors } from '@/components/custom/dashboard/recommended-instructors';
import { StudentDashboard } from '@/components/custom/dashboard/student-dashboard';
import { StudentNextActionBanner } from '@/components/custom/dashboard/student-next-action-banner';
import { dashboardPathFor, requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';
import { ensureSchoolSignupComplete } from '@/lib/signup-resume';

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
  // SCHOOL accounts that bounced here without Membership heal on this hit.
  const school = await ensureSchoolSignupComplete({
    id: session.userId,
    email: session.email,
    name: session.name,
  });
  if (school.ok) {
    redirect(school.next);
  }
  const home = await resolveDashboardHome(session.userId, session.role);
  if (home !== '/dashboard/student') {
    redirect(home);
  }
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
      <StudentNextActionBanner />
      <StudentDashboard />
      <RecommendedInstructors />
    </section>
  );
}
