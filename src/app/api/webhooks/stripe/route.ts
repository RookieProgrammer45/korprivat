// POST /api/webhooks/stripe
// Raw-body signature verify → idempotent ledger → event handlers.
// Canonical host: https://www.drivelinkup.com (ADR-003).

import 'server-only';
import { after, NextResponse } from 'next/server';
import { ensureBookingReceipts } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import { applyConnectAccountUpdated, applyInstructorAccountUpdated } from '@/lib/payments/connect';
import { markBookingPaidFromCheckout } from '@/lib/payments/fulfill-checkout';
import { getStripe } from '@/lib/payments/stripe';
import {
  handleAccountApplicationDeauthorized,
  handleChargeDisputeCreated,
  handleChargeRefunded,
  handleCheckoutSessionExpired,
  handleTransferFailed,
} from '@/lib/payments/stripe-webhook-handlers';
import {
  claimStripeWebhookEvent,
  hashStripePayload,
} from '@/lib/payments/stripe-webhook-ledger';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET missing or empty');
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

  const claim = await claimStripeWebhookEvent({
    eventId: event.id,
    eventType: event.type,
    payloadHash: hashStripePayload(rawBody),
  });
  if (claim === 'duplicate') {
    return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
  }

  switch (event.type) {
    case 'account.updated': {
      const account = event.data.object as Stripe.Account;
      const orgResult = await applyConnectAccountUpdated(account);
      if (orgResult.updated) {
        return NextResponse.json({ ok: true, connect: 'organization' }, { status: 200 });
      }
      const instructorResult = await applyInstructorAccountUpdated(account);
      if (instructorResult.updated) {
        return NextResponse.json({ ok: true, connect: 'instructor' }, { status: 200 });
      }
      return NextResponse.json({ ok: true, connect: false }, { status: 200 });
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.bookingId;
      if (!bookingId) {
        return NextResponse.json({ received: true, skipped: 'no_booking_id' }, { status: 200 });
      }

      const result = await markBookingPaidFromCheckout({
        bookingId,
        stripeSessionId: session.id,
      });

      if (result.kind === 'ignored') {
        console.error(`webhook: unknown booking ${bookingId}`);
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }
      if (result.kind === 'duplicate') {
        return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      }

      after(async () => {
        try {
          const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: { bookedSlot: { select: { startsAt: true, durationMinutes: true } } },
          });
          if (!booking) return;
          const instructor = await prisma.instructor.findUnique({
            where: { id: booking.instructorId },
            select: { name: true, city: true, hourlyRateSek: true },
          });
          if (!instructor) return;
          const amountTotal = typeof session.amount_total === 'number' ? session.amount_total : 0;
          await ensureBookingReceipts({
            booking: { ...booking, slot: booking.bookedSlot, paymentStatus: 'held_escrow' },
            instructor,
            verifiedAmountUsd: Math.max(1, Math.round(amountTotal / 100)),
          });

          const amountSek =
            booking.grossChargedSek ??
            (amountTotal > 0 ? Math.round(amountTotal / 100) : instructor.hourlyRateSek);
          const locale = booking.locale === 'en' ? 'en' : 'sv';
          const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.drivelinkup.com').replace(
            /\/+$/,
            '',
          );
          const { paymentReceiptEmail } = await import('@/lib/email/payment-receipt');
          const { sendEmail } = await import('@/lib/email/send');
          const mail = paymentReceiptEmail({
            locale,
            recipientName: booking.studentName,
            instructorName: instructor.name,
            amountSek,
            bookingId: booking.id,
            bookingUrl: `${appUrl}/bookings/${encodeURIComponent(booking.id)}`,
          });
          await sendEmail({ to: booking.studentEmail, ...mail });
        } catch (error) {
          console.error('[stripe webhook] receipt snapshot failed', error);
        }
      });

      return NextResponse.json({ ok: true, duplicate: false }, { status: 200 });
    }

    case 'charge.dispute.created': {
      await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    case 'charge.refunded': {
      await handleChargeRefunded(event.data.object as Stripe.Charge);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    case 'checkout.session.expired': {
      await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    case 'account.application.deauthorized': {
      // Stripe puts the Connect account id on `event.account`, not the Application object.
      const accountId =
        typeof event.account === 'string'
          ? event.account
          : (event.data.object as Stripe.Application).id;
      await handleAccountApplicationDeauthorized(accountId);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    default: {
      // `transfer.failed` is not always present in the installed Stripe Event union.
      if (event.type === ('transfer.failed' as Stripe.Event['type'])) {
        await handleTransferFailed(event.data.object as Stripe.Transfer);
        return NextResponse.json({ ok: true }, { status: 200 });
      }
      return NextResponse.json({ received: true }, { status: 200 });
    }
  }
}
