// POST /api/admin/payouts/retry — re-attempt Connect transfer for a held booking.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { payoutBooking } from '@/lib/payments/payouts';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bookingId: z.string().min(1),
});

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request) {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await payoutBooking(parsed.data.bookingId, {
    completedByRole: 'instructor',
    completedByLabel: 'admin_retry',
  });

  if (result.kind === 'sent' || result.kind === 'duplicate') {
    return NextResponse.json({ ok: true, result }, { status: 200 });
  }
  if (result.kind === 'skipped') {
    return NextResponse.json({ ok: false, result }, { status: 409 });
  }
  return NextResponse.json({ ok: false, result }, { status: 500 });
}
