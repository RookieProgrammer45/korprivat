//
// Historical CleanupRun read-only listing. Object-storage R2 cleanup has
// been removed; POST returns 410.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CleanupRunsList } from '@/lib/contracts/cleanup-runs';
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
  return NextResponse.json(
    { error: 'gone', message: 'R2 cleanup has been removed; uploads use Vercel Blob only.' },
    { status: 410 },
  );
}
