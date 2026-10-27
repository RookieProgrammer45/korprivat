//
// Learner home after sign-in. Catalogue + "Kontakta skolan" is the live
// path; booking islands stay in the repo but are not shown here.
//
// Role gate: only a Session whose `UserProfile.role === 'STUDENT'` renders
// here. Didit identity verification is not part of this dashboard.

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  dashboardPathFor,
  requireDashboardSession,
  resolveDashboardHome,
} from '@/lib/dashboard-guard';
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
    <section className="grid gap-8">
      <header className="grid gap-2">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <div className="surface-panel flex flex-col items-start gap-5 rounded-[1.25rem] border border-border bg-card p-8">
        <p className="max-w-xl text-body text-muted-foreground">{t('emptyBody')}</p>
        <Link href="/instructors" className="dlu-ink-pill">
          {t('emptyCta')}
        </Link>
      </div>
    </section>
  );
}
