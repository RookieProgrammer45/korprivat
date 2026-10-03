import type { Metadata } from 'next';
import Link from 'next/link';
import { requireAdminServer } from '@/lib/admin-guard';
import { prisma } from '@/lib/db';

export const metadata: Metadata = {
  title: 'Escrow ops',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

const WATCH_STATUSES = [
  'held_escrow',
  'awaiting_buyer_confirmation',
  'release_ready',
  'payout_pending',
  'payout_failed',
] as const;

export default async function AdminEscrowPage() {
  await requireAdminServer();

  const rows = await prisma.booking.findMany({
    where: { paymentStatus: { in: [...WATCH_STATUSES] } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      paymentStatus: true,
      priceAmountSek: true,
      payoutAmountSek: true,
      paidAt: true,
      autoReleaseAt: true,
      organizationId: true,
      createdAt: true,
    },
  });

  const byStatus = WATCH_STATUSES.map((status) => ({
    status,
    count: rows.filter((r) => r.paymentStatus === status).length,
    netSek: rows
      .filter((r) => r.paymentStatus === status)
      .reduce((sum, r) => sum + (r.payoutAmountSek ?? 0), 0),
  }));

  return (
    <section className="grid gap-6">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">Admin</p>
        <h1 className="font-display text-h2 leading-tight tracking-tight text-foreground">
          Escrow ops
        </h1>
        <p className="max-w-2xl text-body text-muted-foreground">
          Pending balances use payoutAmountSek (net), not gross lesson price. Retry failed payouts
          from the booking admin tools when Connect balance is ready.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {byStatus.map((g) => (
          <div key={g.status} className="rounded-lg border border-border p-4">
            <p className="text-eyebrow text-muted-foreground">{g.status}</p>
            <p className="text-h3 tabular-nums text-foreground">{g.count}</p>
            <p className="text-small text-muted-foreground">{g.netSek} SEK net</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[40rem] text-left text-small">
          <thead className="border-b border-border bg-muted/40">
            <tr>
              <th className="px-3 py-2 font-medium">Booking</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Net payout</th>
              <th className="px-3 py-2 font-medium">Gross</th>
              <th className="px-3 py-2 font-medium">School</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-muted-foreground">
                  No held or stuck escrow bookings.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link className="underline underline-offset-2" href={`/bookings/${row.id}`}>
                      {row.id.slice(0, 10)}…
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.paymentStatus}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.payoutAmountSek == null ? '—' : `${row.payoutAmountSek} SEK`}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {row.priceAmountSek == null ? '—' : `${row.priceAmountSek} SEK`}
                  </td>
                  <td className="px-3 py-2">{row.organizationId ? 'yes' : 'no'}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {row.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
