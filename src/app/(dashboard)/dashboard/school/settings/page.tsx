import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SchoolSettingsForm } from '@/components/custom/school/school-settings-form';
import { Button } from '@/components/ui/button';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import { listMembershipsForUser } from '@/lib/orgs/service';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('schoolSettings');
  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function SchoolSettingsPage() {
  const session = await requireDashboardSession('/dashboard/school/settings');
  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  const membership = memberships.find((m) => m.role === 'OWNER' || m.role === 'STAFF');
  if (!membership) {
    redirect('/for-skolor');
  }

  const org = membership.organization;
  const isOwner = membership.role === 'OWNER';
  const t = await getTranslations('schoolSettings');
  const tDash = await getTranslations('dashboardSchool.settings');

  return (
    <section className="grid gap-6">
      <header className="grid gap-2">
        <h1 className="font-display text-h2 text-foreground">{t('title')}</h1>
        {!isOwner ? (
          <p className="text-small text-muted-foreground">{tDash('body')}</p>
        ) : null}
      </header>
      <SchoolSettingsForm
        organizationId={org.id}
        readOnly={!isOwner}
        initial={{
          name: org.name,
          organizationNumber: org.organizationNumber,
          address: org.address ?? '',
          postcode: org.postcode ?? '',
          city: org.city ?? '',
          contactEmail: org.contactEmail ?? '',
          contactPhone: org.contactPhone ?? '',
        }}
      />
      <Button asChild variant="secondary" size="sm" className="w-fit">
        <Link href="/dashboard/school">{tDash('back')}</Link>
      </Button>
    </section>
  );
}
