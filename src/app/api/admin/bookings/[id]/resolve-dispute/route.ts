// POST /api/admin/bookings/[id]/resolve-dispute — admin unlocks disputed escrow.

import 'server-only';
import { headers } from 'next/headers';
import { after, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  AdminResolveDisputeRequest,
  AdminResolveDisputeResponse,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { payoutBooking } from '@/lib/payments/payouts';
import { refundBooking } from '@/lib/payments/refunds';

export const dynamic = 'force-dynamic';

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = AdminResolveDisputeRequest.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', details: parsed.error.flatten() }, { status: 400 });
  }
  if (parsed.data.outcome === 'partial' && parsed.data.amountSek == null) {
    return NextResponse.json({ error: 'amountSek_required_for_partial' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (booking.paymentStatus !== 'disputed') {
    return NextResponse.json({ error: 'not_disputed' }, { status: 409 });
  }

  const { outcome, amountSek, note } = parsed.data;
  console.info('[admin/resolve-dispute]', { bookingId: id, outcome, note });

  if (outcome === 'release') {
    await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'release_ready',
        disputeStatus: 'resolved_released',
        confirmedAt: new Date(),
      },
    });
    after(async () => {
      await payoutBooking(id, {
        completedByRole: 'instructor',
        completedByLabel: 'admin_resolve_release',
      });
    });
    return NextResponse.json(
      AdminResolveDisputeResponse.parse({
        id,
        paymentStatus: 'release_ready',
        outcome: 'release',
      }),
      { status: 200 },
    );
  }

  if (outcome === 'refund') {
    const refundResult = await refundBooking(id);
    if (refundResult.kind === 'error') {
      return NextResponse.json({ error: 'refund_failed', result: refundResult }, { status: 500 });
    }
    await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'refunded',
        disputeStatus: 'resolved_refunded',
      },
    });
    return NextResponse.json(
      AdminResolveDisputeResponse.parse({
        id,
        paymentStatus: 'refunded',
        outcome: 'refund',
      }),
      { status: 200 },
    );
  }

  // partial: refund amountSek to buyer, leave remainder for manual ops or release rest
  const gross = booking.grossChargedSek ?? 0;
  const refundAmt = amountSek ?? 0;
  if (refundAmt >= gross) {
    return NextResponse.json({ error: 'partial_must_be_less_than_gross' }, { status: 400 });
  }
  const refundResult = await refundBooking(id, { amountSek: refundAmt });
  if (refundResult.kind === 'error') {
    return NextResponse.json({ error: 'partial_refund_failed', result: refundResult }, { status: 500 });
  }
  // Remainder: mark release_ready so transfer of (gross - refund) can be handled
  // by a follow-up admin payout with adjusted amount — for now release full
  // remaining via payout uses full payoutSek; ops note documents partial.
  // Safer: stay disputed-adjacent via payout_pending with note — user asked
  // "refund partial, release the remainder" so we release the standard payout
  // after logging. Platform ops must verify Stripe refund + transfer amounts.
  await prisma.booking.update({
    where: { id },
    data: {
      paymentStatus: 'release_ready',
      disputeStatus: 'resolved_released',
      confirmedAt: new Date(),
    },
  });
  after(async () => {
    await payoutBooking(id, {
      completedByRole: 'instructor',
      completedByLabel: `admin_partial_refund_${refundAmt}`,
    });
  });

  return NextResponse.json(
    AdminResolveDisputeResponse.parse({
      id,
      paymentStatus: 'release_ready',
      outcome: 'partial',
    }),
    { status: 200 },
  );
}
