// POST /api/webhooks/stripe
// Raw-body signature verify → checkout.session.completed → mark booking paid.
// Idempotent via Booking.paidAt / stripeSessionId unique.

import 'server-only';
import { NextResponse } from 'next/server';
import { ensureBookingReceipts } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import { markBookingPaidFromCheckout } from '@/lib/payments/fulfill-checkout';
import { getStripe } from '@/lib/payments/stripe';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'missing_signature' }, { status: 401 });
  }

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  // Ack immediately for types we ignore; process checkout.session.completed below.
  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true }, { status: 200 });
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) {
    return NextResponse.json({ received: true, skipped: 'no_booking_id' }, { status: 200 });
  }

  // Heavy work after signature OK — still await here so serverless doesn't
  // freeze mid-flight; return 200 with duplicate flag when already paid.
  const result = await markBookingPaidFromCheckout({
    bookingId,
    stripeSessionId: session.id,
  });

  if (result.duplicate) {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  // Best-effort receipt snapshots — never fail the webhook on mail/receipt errors.
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { bookedSlot: { select: { startsAt: true, durationMinutes: true } } },
    });
    if (booking) {
      const instructor = await prisma.instructor.findUnique({
        where: { id: booking.instructorId },
        select: { name: true, city: true, hourlyRateSek: true },
      });
      if (instructor) {
        const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0;
        // amount_total is in öre for SEK; receipts still accept a USD-ish number
        // for legacy snapshot fields — pass SEK major units as a stand-in.
        await ensureBookingReceipts({
          booking: { ...booking, slot: booking.bookedSlot, paymentStatus: 'held_escrow' },
          instructor,
          verifiedAmountUsd: Math.max(1, Math.round(amountTotal / 100)),
        });
      }
    }
  } catch (error) {
    console.error('[stripe webhook] receipt snapshot failed', error);
  }

  return NextResponse.json({ ok: true, duplicate: false }, { status: 200 });
}
