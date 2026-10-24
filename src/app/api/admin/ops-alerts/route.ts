import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isOpsAlertingOn } from '@/lib/ops/alerting-policy';
import { readOpsAlertSnapshot } from '@/lib/ops/alerting-store';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isOpsAlertingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  return NextResponse.json(await readOpsAlertSnapshot());
}
