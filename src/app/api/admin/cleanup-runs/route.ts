// @polsia:user-owned — admin R2-cleanup runs surface.
//
// Two verbs:
//   GET  — last 50 CleanupRun rows with their final `scanned` / `deleted`
//          counters, gated by an inline admin check (NOT `requireAdmin`,
//          which redirects on non-admin — wrong UX for an API client
//          that wants a 403 to render an error state).
//   POST — runs the cleanup on demand (mirror of jobs/r2-cleanup.js),
//          gated by the same admin check, returns the row totals.
//
// Both verbs are `force-dynamic` so they're never statically cached, and
// the admin "Run now" button always sees fresh data on the next refetch.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { runCleanup } from '@/lib/business/r2-cleanup';
import { CleanupRunCreated, CleanupRunsList } from '@/lib/contracts/cleanup-runs';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const rows = await prisma.cleanupRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      status: true,
      trigger: true,
      scanned: true,
      deleted: true,
      error: true,
    },
  });

  const payload = CleanupRunsList.parse({
    items: rows.map((r) => ({
      id: r.id,
      startedAt: r.startedAt.toISOString(),
      finishedAt: r.finishedAt?.toISOString() ?? null,
      status: r.status ?? null,
      trigger: r.trigger === 'admin' ? ('admin' as const) : ('cron' as const),
      scanned: r.scanned ?? null,
      deleted: r.deleted ?? null,
      error: r.error ?? null,
    })),
  });
  return NextResponse.json(payload);
}

export async function POST() {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const summary = await runCleanup({ trigger: 'admin' });
  return NextResponse.json(
    CleanupRunCreated.parse({
      runId: summary.runId,
      scanned: summary.scanned,
      deleted: summary.deleted,
    }),
    { status: 201 },
  );
}
