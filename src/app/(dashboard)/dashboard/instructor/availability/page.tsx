// @polsia:user-owned — `/dashboard/instructor/availability` server page.
//
// Server Component shell: session-gated via `requireDashboardSession`, sets
// `metadata`, and mounts the <AvailabilityEditor/> client island. The
// island is the actual data plane — it fetches and mutates via
// /api/instructor-availability; the page itself does NOT touch Prisma
// (the data-plane rule).

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { AvailabilityEditor } from '@/components/custom/dashboard/availability-editor';
import { dashboardPathFor, requireDashboardSession } from '@/lib/dashboard-guard';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard.instructor.availability');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/instructor/availability' },
    robots: { index: false, follow: false },
  };
}

export default async function InstructorAvailabilityPage() {
  const session = await requireDashboardSession('/dashboard/instructor/availability');
  if (session.role !== 'INSTRUCTOR') redirect(dashboardPathFor(session.role));
  const t = await getTranslations('dashboard.instructor.availability');

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <AvailabilityEditor />
    </section>
  );
}
