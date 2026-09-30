import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import { listMembershipsForUser } from '@/lib/orgs/service';
import { prisma } from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('revenue');
  return {
    title: t('schoolTitle'),
    alternates: { canonical: '/dashboard/school/revenue' },
    robots: { index: false, follow: false },
  };
}

export default async function SchoolRevenuePage() {
  const session = await requireDashboardSession('/dashboard/school/revenue');
  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  const membership = memberships.find((m) => m.role === 'OWNER' || m.role === 'STAFF');
  if (!membership) {
    redirect('/for-skolor');
  }

  const t = await getTranslations('revenue');
  const orgId = membership.organization.id;

  const payouts = await prisma.payoutRecord.findMany({
    where: { recipientType: 'ORGANIZATION', recipientId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const totalSek = payouts.reduce((sum, row) => sum + row.amountSek, 0);
  const count = payouts.length;

  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('schoolTitle')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('schoolLead')}</p>
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/school">{t('back')}</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border bg-card">
          <CardContent className="grid gap-1 p-5">
            <p className="text-small text-muted-foreground">{t('metricTotal')}</p>
            <p className="font-display text-h3 text-foreground">
              {t('amountSek', { amount: totalSek })}
            </p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="grid gap-1 p-5">
            <p className="text-small text-muted-foreground">{t('metricCount')}</p>
            <p className="font-display text-h3 text-foreground">{count}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border bg-card">
        <CardContent className="grid gap-4 p-5">
          <p className="font-medium text-foreground">{t('tableTitle')}</p>
          {payouts.length === 0 ? (
            <p className="text-small text-muted-foreground">{t('empty')}</p>
          ) : (
            <ul className="grid gap-3">
              {payouts.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0"
                >
                  <div className="grid gap-0.5">
                    <p className="text-small font-medium text-foreground">
                      {t('bookingLabel', { id: row.bookingId.slice(0, 8) })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.createdAt.toISOString().slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{row.status}</Badge>
                    <p className="text-small font-medium text-foreground">
                      {t('amountSek', { amount: row.amountSek })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
