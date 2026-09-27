//
// Server Component: greeting + the <StudentDashboard/> client island that
// fetches /api/bookings/me AND a sibling <RecommendedInstructors/>
// island that fetches /api/instructors/recommendations. No data-fetches
// in the page body — composition only.
//
// Role gate: only a Session whose `UserProfile.role === 'STUDENT'` renders
// here. Soft verification banner when identity is not yet ACTIVE.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RecommendedInstructors } from '@/components/custom/dashboard/recommended-instructors';
import { StudentDashboard } from '@/components/custom/dashboard/student-dashboard';
import { DiditVerifyButton } from '@/components/custom/verification/didit-verify-button';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';
import { getStoredLearnerState } from '@/lib/signup-resume';

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

  const verificationState = await getStoredLearnerState(session.userId);
  const showVerifyBanner =
    verificationState === 'SIGNED_UP' ||
    verificationState === 'DIDIT_PENDING' ||
    verificationState === 'DIDIT_FAILED';

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      {showVerifyBanner ? (
        <aside className="flex flex-col gap-3 rounded-xl border border-brand-500/35 bg-brand-50/80 px-4 py-3 text-small text-foreground sm:flex-row sm:items-start sm:justify-between dark:bg-brand-950/40">
          <div className="grid gap-1">
            <p className="text-pretty font-medium">{t('verifyBanner.body')}</p>
            <p className="text-pretty text-muted-foreground">
              {t('verifyBanner.disclosure')}
            </p>
          </div>
          <DiditVerifyButton className="sm:max-w-xs sm:shrink-0" />
        </aside>
      ) : null}
      <StudentDashboard />
      <RecommendedInstructors />
    </section>
  );
}
