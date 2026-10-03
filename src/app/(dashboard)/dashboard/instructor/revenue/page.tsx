import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { dashboardPathFor, requireDashboardSession, resolveDashboardHome } from '@/lib/dashboard-guard';
import { prisma } from '@/lib/db';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('revenue');
  return {
    title: t('instructorTitle'),
    alternates: { canonical: '/dashboard/instructor/revenue' },
    robots: { index: false, follow: false },
  };
}

export default async function InstructorRevenuePage() {
  const session = await requireDashboardSession('/dashboard/instructor/revenue');
  const home = await resolveDashboardHome(session.userId, session.role);
  if (home !== '/dashboard/instructor') {
    redirect(home);
  }
  if (session.role !== 'INSTRUCTOR') {
    redirect(dashboardPathFor(session.role));
  }

  const t = await getTranslations('revenue');
  const instructor = await prisma.instructor.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });
  if (!instructor) {
    redirect('/dashboard/instructor');
  }

  const payouts = await prisma.payoutRecord.findMany({
    where: { recipientType: 'INSTRUCTOR', recipientId: instructor.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const balanceGroups = await prisma.booking.groupBy({
    by: ['paymentStatus'],
    where: {
      instructorId: instructor.id,
      paymentStatus: {
        in: ['held_escrow', 'awaiting_buyer_confirmation', 'release_ready', 'payout_pending', 'payout_failed'],
      },
    },
    _sum: { payoutAmountSek: true },
    _count: { _all: true },
  });
  const balanceByStatus = Object.fromEntries(
    balanceGroups.map((g) => [
      g.paymentStatus ?? 'unknown',
      { count: g._count._all, sek: g._sum.payoutAmountSek ?? 0 },
    ]),
  );

  const totalSek = payouts.reduce((sum, row) => sum + row.amountSek, 0);
  const count = payouts.length;

  return (
    <section className="grid gap-6">
      <header className="grid gap-3">
        <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          {t('instructorTitle')}
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">{t('instructorLead')}</p>
        <div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard/instructor">{t('back')}</Link>
          </Button>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <Card className="border-border bg-card sm:col-span-2 lg:col-span-1">
          <CardContent className="grid gap-2 p-5">
            <p className="text-small text-muted-foreground">Pending balance (net)</p>
            <ul className="grid gap-1 text-small text-foreground">
              {(
                [
                  'held_escrow',
                  'awaiting_buyer_confirmation',
                  'release_ready',
                  'payout_pending',
                  'payout_failed',
                ] as const
              ).map((status) => {
                const row = balanceByStatus[status];
                if (!row || row.count === 0) return null;
                return (
                  <li key={status} className="flex justify-between gap-3 tabular-nums">
                    <span className="text-muted-foreground">{status}</span>
                    <span>
                      {row.count} · {t('amountSek', { amount: row.sek })}
                    </span>
                  </li>
                );
              })}
            </ul>
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
