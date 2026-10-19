// Deep health check for uptime monitoring: verifies the app can reach the
// database (SELECT 1 with a hard timeout) instead of just reporting the
// process is up. Fail-closed: a DB problem returns 503 so monitors page.
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DB_CHECK_TIMEOUT_MS = 3000;

async function pingDb(): Promise<boolean> {
  const { prisma } = await import('@/lib/db');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('db check timeout')), DB_CHECK_TIMEOUT_MS);
  });
  try {
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const db = await pingDb();
  return NextResponse.json(
    { status: db ? 'healthy' : 'unhealthy', db: db ? 'ok' : 'error' },
    { status: db ? 200 : 503 },
  );
}
