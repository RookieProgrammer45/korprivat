import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import { listMembershipsForUser } from '@/lib/orgs/service';
import { redirect } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboardSchool.settings');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

/** Placeholder — school settings ship in a later slice. */
export default async function SchoolSettingsStubPage() {
  const session = await requireDashboardSession('/dashboard/school/settings');
  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  if (!memberships.some((m) => m.role === 'OWNER' || m.role === 'STAFF')) {
    redirect('/for-skolor');
  }
  const t = await getTranslations('dashboardSchool.settings');

  return (
    <section className="grid max-w-lg gap-4">
      <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
      <p className="text-body text-muted-foreground">{t('body')}</p>
      <Button asChild variant="secondary" size="sm" className="w-fit">
        <Link href="/dashboard/school">{t('back')}</Link>
      </Button>
    </section>
  );
}
