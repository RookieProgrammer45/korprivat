// POST /api/admin/payouts/retry — re-attempt Connect transfer for a booking
// already in a payout-ready state (release_ready | payout_pending | payout_failed).
// Does NOT bypass delivery confirmation / dispute windows.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { payoutBooking } from '@/lib/payments/payouts';

export const dynamic = 'force-dynamic';

const Body = z.object({
  bookingId: z.string().min(1),
});

const ALLOWED_RETRY_STATES = ['release_ready', 'payout_pending', 'payout_failed'] as const;

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

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.data.bookingId },
    select: { id: true, paymentStatus: true },
  });
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const currentState = booking.paymentStatus ?? 'unpaid';
  if (!(ALLOWED_RETRY_STATES as readonly string[]).includes(currentState)) {
    let message = 'Retry is only allowed for payout-ready states.';
    if (currentState === 'held_escrow') {
      message = 'Use the delivery flow, not retry.';
    } else if (currentState === 'awaiting_buyer_confirmation') {
      message =
        'Waiting for buyer confirmation or auto-release. Retry does not bypass the dispute window.';
    } else if (currentState === 'disputed') {
      message = 'Resolve the dispute before retrying payout.';
    } else if (
      currentState === 'released' ||
      currentState === 'refunded' ||
      currentState.startsWith('cancelled_')
    ) {
      message = 'Booking is already terminal; no payout retry.';
    }
    return NextResponse.json(
      {
        error: 'invalid_state',
        currentState,
        allowed: [...ALLOWED_RETRY_STATES],
        message,
      },
      { status: 409 },
    );
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
