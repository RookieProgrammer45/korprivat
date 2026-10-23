import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isReliableProcessingOn } from '@/lib/reliability/inbox-policy';
import { tickOutbox } from '@/lib/reliability/inbox-store';

export const dynamic = 'force-dynamic';

export async function POST() {
  if (!isReliableProcessingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  const result = await tickOutbox(new Date());
  return NextResponse.json(result);
}
