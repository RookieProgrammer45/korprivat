// @polsia:user-owned — `/dashboard/admin/instructor-licenses`
//
// Server Component shell — `requireAdminServer()` runs server-side and
// redirects non-admins, so the page is gated before any data is read.
// The interactive table (fetch + Verify/Reject buttons) lives in the
// client island imported below.

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InstructorLicenseDecisionTable } from '@/components/custom/admin/instructor-license-decision-table';
import { requireAdminServer } from '@/lib/admin-guard';

export const metadata: Metadata = {
  title: 'Instructor-licence review',
  robots: { index: false, follow: false },
};

export default async function AdminInstructorLicensesPage() {
  await requireAdminServer();
  const t = await getTranslations('dashboard.admin.instructorLicenses');
  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('title')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
      </header>
      <InstructorLicenseDecisionTable />
    </section>
  );
}
