// POST /api/admin/bookings/[id]/resolve-dispute — admin unlocks disputed escrow.
// Outcomes: release | refund. Partial is intentionally disabled (501) until
// payout math accounts for the refunded amount.

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

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  if (booking.paymentStatus !== 'disputed') {
    return NextResponse.json({ error: 'not_disputed' }, { status: 409 });
  }

  const { outcome, note, amountSek } = parsed.data;
  console.info('[admin/resolve-dispute]', { bookingId: id, outcome, note, amountSek });

  if (outcome === 'partial') {
    // ADR-005: refund amountSek to learner, transfer remainder of payout snapshot.
    if (amountSek == null || amountSek <= 0) {
      return NextResponse.json({ error: 'amount_required' }, { status: 400 });
    }
    if (booking.payoutAmountSek == null) {
      return NextResponse.json({ error: 'missing_fee_snapshot' }, { status: 409 });
    }
    const { partialPayoutAfterRefund } = await import('@/lib/trust/disputes');
    const math = partialPayoutAfterRefund({
      payoutAmountSek: booking.payoutAmountSek,
      refundSek: amountSek,
    });
    const refundResult = await refundBooking(id, { amountSek: math.refundSek });
    if (refundResult.kind === 'error') {
      return NextResponse.json({ error: 'refund_failed', result: refundResult }, { status: 500 });
    }
    if (math.transferSek > 0) {
      await prisma.booking.update({
        where: { id },
        data: {
          paymentStatus: 'release_ready',
          disputeStatus: 'resolved_partial',
          confirmedAt: new Date(),
          payoutAmountSek: math.transferSek,
        },
      });
      after(async () => {
        await payoutBooking(id, {
          completedByRole: 'instructor',
          completedByLabel: 'admin_resolve_partial',
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
    await prisma.booking.update({
      where: { id },
      data: {
        paymentStatus: 'refunded',
        disputeStatus: 'resolved_partial',
      },
    });
    return NextResponse.json(
      AdminResolveDisputeResponse.parse({
        id,
        paymentStatus: 'refunded',
        outcome: 'partial',
      }),
      { status: 200 },
    );
  }

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

  // outcome === 'refund'
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
