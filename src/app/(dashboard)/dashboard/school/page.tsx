import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import { listMembershipsForUser } from '@/lib/orgs/service';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboardSchool');
  return {
    title: t('title'),
    alternates: { canonical: '/dashboard/school' },
    robots: { index: false, follow: false },
  };
}

function verificationLabel(
  state: string,
  t: Awaited<ReturnType<typeof getTranslations<'dashboardSchool'>>>,
): string {
  if (state === 'APPROVED') return t('verificationApproved');
  if (state === 'PENDING') return t('verificationPending');
  return t('verificationDraft');
}

export default async function SchoolDashboardPage() {
  const session = await requireDashboardSession('/dashboard/school');
  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  const membership = memberships.find((m) => m.role === 'OWNER' || m.role === 'STAFF');
  if (!membership) {
    redirect('/for-skolor');
  }

  const org = membership.organization;
  const t = await getTranslations('dashboardSchool');
  const isDraft = org.verificationState === 'DRAFT';

  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
            {t('welcome', { name: org.name })}
          </h1>
          <Badge
            variant="outline"
            className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
          >
            {verificationLabel(org.verificationState, t)}
          </Badge>
        </div>
        <p className="text-body text-muted-foreground">
          {t('orgNumber', { number: org.organizationNumber })}
        </p>
      </header>

      {isDraft ? (
        <Card className="border-border bg-card text-card-foreground">
          <CardContent className="grid gap-3 p-6">
            <p className="font-medium text-foreground">{t('draftCardTitle')}</p>
            <p className="text-small text-muted-foreground">{t('draftCardBody')}</p>
            <div>
              <Button asChild variant="secondary" size="sm">
                <Link href="/dashboard/school/settings">{t('draftCardCta')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border bg-card">
        <CardContent className="grid gap-4 p-6">
          <p className="font-display text-h3 text-foreground">{t('emptyInstructors')}</p>
          <Button type="button" disabled size="sm" className="w-fit">
            {t('inviteInstructor')}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        {(['bookings', 'revenue', 'settings'] as const).map((key) => (
          <Card key={key} className="border-border bg-card opacity-70">
            <CardContent className="grid gap-2 p-5">
              <p className="font-medium text-foreground">{t(`panels.${key}.title`)}</p>
              <p className="text-small text-muted-foreground">{t('comingSoon')}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
