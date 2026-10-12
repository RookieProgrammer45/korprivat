// POST /api/webhooks/stripe
// Raw-body signature verify → idempotent effects → successful-delivery ledger.
// The ledger is finalized only after handlers complete so a failed payment
// reconciliation remains retriable instead of being permanently poisoned.

import 'server-only';
import { after, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { ensureBookingReceipts } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import { validateBookingCheckoutAmount } from '@/lib/payments/checkout-amount';
import { applyConnectAccountUpdated, applyInstructorAccountUpdated } from '@/lib/payments/connect';
import { markBookingPaidFromCheckout } from '@/lib/payments/fulfill-checkout';
import { reconcileCancelledCheckoutCapture } from '@/lib/payments/refunds';
import { getStripe } from '@/lib/payments/stripe';
import {
  handleAccountApplicationDeauthorized,
  handleChargeDisputeCreated,
  handleChargeRefunded,
  handleCheckoutSessionExpired,
  handleTransferFailed,
} from '@/lib/payments/stripe-webhook-handlers';
import { claimStripeWebhookEvent, hashStripePayload } from '@/lib/payments/stripe-webhook-ledger';

export const dynamic = 'force-dynamic';

type ResponseBody = Record<string, unknown>;

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret?.trim()) {
    console.error('[stripe webhook] STRIPE_WEBHOOK_SECRET missing or empty');
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 401 });

  const rawBody = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const acknowledge = async (body: ResponseBody) => {
    const claim = await claimStripeWebhookEvent({
      eventId: event.id,
      eventType: event.type,
      payloadHash: hashStripePayload(rawBody),
    });
    if (claim === 'duplicate')
      return NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
    return NextResponse.json(body, { status: 200 });
  };

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        const orgResult = await applyConnectAccountUpdated(account);
        if (orgResult.updated) return acknowledge({ ok: true, connect: 'organization' });
        const instructorResult = await applyInstructorAccountUpdated(account);
        return acknowledge({ ok: true, connect: instructorResult.updated ? 'instructor' : false });
      }

      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;
        if (!bookingId) return acknowledge({ received: true, skipped: 'no_booking_id' });

        // Validate immutable SEK payment evidence before any state transition.
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { bookedSlot: { select: { startsAt: true, durationMinutes: true } } },
        });
        if (!booking) {
          console.error(`[stripe webhook] unknown booking ${bookingId}`);
          return acknowledge({ ok: true, ignored: true });
        }
        const amount = validateBookingCheckoutAmount({
          currency: session.currency,
          amountTotal: session.amount_total,
          grossChargedSek: booking.grossChargedSek,
        });
        if (session.payment_status !== 'paid' || !amount.ok) {
          console.error('[stripe webhook] checkout validation failed; leaving delivery retriable', {
            bookingId,
            sessionId: session.id,
            paymentStatus: session.payment_status,
            reason: amount.ok ? 'unpaid' : amount.reason,
          });
          return NextResponse.json(
            { error: 'checkout_validation_failed', reason: amount.ok ? 'unpaid' : amount.reason },
            { status: 500 },
          );
        }

        const result = await markBookingPaidFromCheckout({
          bookingId,
          stripeSessionId: session.id,
        });
        if (result.kind === 'ignored') {
          // The row disappeared after validation. Do not claim; a delayed retry
          // can still be reconciled after the data race is investigated.
          return NextResponse.json({ error: 'booking_disappeared' }, { status: 500 });
        }
        if (result.kind === 'cancelled') {
          const reconciliation = await reconcileCancelledCheckoutCapture({
            bookingId: result.booking.id,
            sessionId: session.id,
            cancellationOutcome: result.booking.cancellationOutcome ?? result.booking.paymentStatus,
            cancellationPolicyTier: result.booking.cancellationPolicyTier,
            grossChargedSek: result.booking.grossChargedSek,
            forceFullRefund: result.booking.paidAt == null && result.booking.heldAt == null,
            session,
          });
          if (
            reconciliation.kind === 'error' ||
            reconciliation.kind === 'pending' ||
            (reconciliation.kind === 'skipped' && reconciliation.reason === 'no_payment_intent')
          ) {
            console.error('[stripe webhook] cancelled capture reconciliation failed', {
              bookingId,
              reconciliation,
            });
            return NextResponse.json(
              { error: 'cancelled_capture_reconciliation_failed' },
              { status: 500 },
            );
          }
          return acknowledge({ ok: true, cancelled: true, reconciled: reconciliation.kind });
        }

        // A previous delivery can have won the payment CAS but died before
        // receipt persistence. Re-run receipt upserts with the same validated
        // SEK amount before ledger finalization.
        const paidBooking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { bookedSlot: { select: { startsAt: true, durationMinutes: true } } },
        });
        if (!paidBooking)
          return NextResponse.json({ error: 'booking_disappeared' }, { status: 500 });
        const instructor = await prisma.instructor.findUnique({
          where: { id: paidBooking.instructorId },
          select: { name: true, city: true, hourlyRateSek: true },
        });
        if (!instructor) return NextResponse.json({ error: 'instructor_missing' }, { status: 500 });
        await ensureBookingReceipts({
          booking: { ...paidBooking, slot: paidBooking.bookedSlot, paymentStatus: 'held_escrow' },
          instructor,
          verifiedAmountSek: amount.amountSek,
        });

        if (result.kind === 'paid') {
          after(async () => {
            try {
              const locale = paidBooking.locale === 'en' ? 'en' : 'sv';
              const appUrl = (
                process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.drivelinkup.com'
              ).replace(/\/+$/, '');
              const { paymentReceiptEmail } = await import('@/lib/email/payment-receipt');
              const { sendEmail } = await import('@/lib/email/send');
              const mail = paymentReceiptEmail({
                locale,
                recipientName: paidBooking.studentName,
                instructorName: instructor.name,
                amountSek: amount.amountSek,
                bookingId: paidBooking.id,
                bookingUrl: `${appUrl}/bookings/${encodeURIComponent(paidBooking.id)}`,
              });
              await sendEmail({ to: paidBooking.studentEmail, ...mail });
            } catch (error) {
              console.error('[stripe webhook] payment receipt email failed', error);
            }
          });
        }
        return acknowledge({ ok: true, duplicate: result.kind === 'duplicate' });
      }

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object as Stripe.Dispute);
        return acknowledge({ ok: true });

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        return acknowledge({ ok: true });

      case 'checkout.session.expired':
        await handleCheckoutSessionExpired(event.data.object as Stripe.Checkout.Session);
        return acknowledge({ ok: true });

      case 'account.application.deauthorized': {
        const accountId =
          typeof event.account === 'string'
            ? event.account
            : (event.data.object as Stripe.Application).id;
        await handleAccountApplicationDeauthorized(accountId);
        return acknowledge({ ok: true });
      }

      default:
        if (event.type === ('transfer.failed' as Stripe.Event['type'])) {
          await handleTransferFailed(event.data.object as Stripe.Transfer);
          return acknowledge({ ok: true });
        }
        return acknowledge({ received: true });
    }
  } catch (error) {
    // No ledger claim has been made yet. Stripe will retry this delivery and
    // every payment/refund operation uses its own CAS or idempotency key.
    console.error('[stripe webhook] handler failed; leaving delivery retriable', error);
    return NextResponse.json({ error: 'webhook_processing_failed' }, { status: 500 });
  }
}
