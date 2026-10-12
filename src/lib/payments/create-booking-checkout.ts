// Shared by checkout and instructor acceptance. Stripe calls stay outside DB
// transactions. A durable issuance claim serializes/retries each new attempt.
import 'server-only';
import type Stripe from 'stripe';
import { learnerTotalSek, lessonPriceForDurationSek } from '@/lib/business/booking-fees';
import { prisma } from '@/lib/db';
import {
  checkoutIssuanceIdempotencyKey,
  isCheckoutIssuanceClaim,
  newCheckoutIssuanceClaim,
  readCheckoutIssuanceParams,
} from '@/lib/payments/checkout-issuance';
import { resolveOrigin } from '@/lib/payments/origin';
import { reconcileCancelledCheckoutCapture } from '@/lib/payments/refunds';
import { getStripe } from '@/lib/payments/stripe';

export class CheckoutConfigurationError extends Error {
  constructor(message = 'Stripe is not configured') {
    super(message);
    this.name = 'CheckoutConfigurationError';
  }
}
export class CheckoutUnavailableError extends Error {
  constructor() {
    super('booking_not_payable');
    this.name = 'CheckoutUnavailableError';
  }
}
export class CheckoutRecoveryError extends Error {
  constructor() {
    super('checkout_recovery_required');
    this.name = 'CheckoutRecoveryError';
  }
}

const CANCELLED_STATES = [
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
];
function isCancelled(booking: {
  cancellationOutcome: string | null;
  paymentStatus: string | null;
}) {
  return (
    booking.cancellationOutcome != null || CANCELLED_STATES.includes(booking.paymentStatus ?? '')
  );
}

async function expireCheckoutSession(sessionId: string): Promise<boolean> {
  try {
    await getStripe().checkout.sessions.expire(sessionId);
    return true;
  } catch (error) {
    console.warn('[checkout] unable to expire session', {
      sessionId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return false;
  }
}

export async function createBookingCheckoutSession(input: {
  bookingId: string;
  req: Request;
  accessToken?: string | null;
  userId?: string | null;
}): Promise<{ url: string; stripeSessionId: string }> {
  if (!process.env.STRIPE_SECRET_KEY) throw new CheckoutConfigurationError();
  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
    include: { bookedSlot: { select: { durationMinutes: true } } },
  });
  if (!booking) throw new Error('booking_not_found');
  if (
    isCancelled(booking) ||
    booking.paidAt != null ||
    !['unpaid', 'pending', null].includes(booking.paymentStatus)
  ) {
    throw new CheckoutUnavailableError();
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, name: true, hourlyRateSek: true },
  });
  if (!instructor) throw new Error('instructor_not_found');
  const totals =
    booking.priceAmountSek != null &&
    booking.serviceFeeSek != null &&
    booking.grossChargedSek != null
      ? {
          priceSek: booking.priceAmountSek,
          serviceFeeSek: booking.serviceFeeSek,
          totalSek: booking.grossChargedSek,
        }
      : learnerTotalSek(
          lessonPriceForDurationSek(
            instructor.hourlyRateSek,
            booking.bookedSlot?.durationMinutes ?? 60,
          ),
        );

  const stripe = getStripe();
  const previousId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (previousId && !isCheckoutIssuanceClaim(previousId)) {
    let existing: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>;
    try {
      existing = await stripe.checkout.sessions.retrieve(previousId);
    } catch {
      throw new CheckoutRecoveryError();
    }
    if (existing.payment_status === 'paid' || existing.status === 'complete')
      throw new CheckoutUnavailableError();
    if (existing.status === 'open' && existing.url) {
      const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
      if (
        !fresh ||
        isCancelled(fresh) ||
        fresh.paidAt != null ||
        fresh.paymentStatus !== 'pending' ||
        (fresh.stripeSessionId ?? fresh.stripeCheckoutSessionId) !== previousId
      ) {
        throw new CheckoutUnavailableError();
      }
      return { url: existing.url, stripeSessionId: previousId };
    }
    if (
      existing.status !== 'expired' &&
      !(existing.status === 'open' && (await expireCheckoutSession(previousId)))
    ) {
      throw new CheckoutRecoveryError();
    }
  }

  const appUrl = resolveOrigin(input.req).replace(/\/+$/, '');
  const requestedParams = {
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'sek',
          unit_amount: totals.totalSek * 100,
          product_data: {
            name:
              booking.locale === 'en' ? 'Driving lesson — DriveLinkUp' : 'Körlektion — DriveLinkUp',
          },
        },
      },
    ],
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancelled`,
    metadata: {
      bookingId: booking.id,
      ...(booking.userId ? { userId: booking.userId } : {}),
      priceSek: String(totals.priceSek),
      serviceFeeSek: String(totals.serviceFeeSek),
      grossChargedSek: String(totals.totalSek),
    },
  } satisfies Stripe.Checkout.SessionCreateParams;

  let claim = previousId && isCheckoutIssuanceClaim(previousId) ? previousId : null;
  if (!claim) {
    claim = newCheckoutIssuanceClaim(requestedParams);
    const claimed = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        cancellationOutcome: null,
        paidAt: null,
        OR: [{ paymentStatus: { in: ['unpaid', 'pending'] } }, { paymentStatus: null }],
        stripeSessionId: booking.stripeSessionId ?? null,
        stripeCheckoutSessionId: booking.stripeCheckoutSessionId ?? null,
      },
      data: {
        paymentStatus: 'pending',
        stripeSessionId: null,
        stripeCheckoutSessionId: claim,
        priceAmountSek: totals.priceSek,
        serviceFeeSek: totals.serviceFeeSek,
        grossChargedSek: totals.totalSek,
      },
    });
    if (claimed.count !== 1) throw new CheckoutUnavailableError();
  }

  const session = await stripe.checkout.sessions.create(
    readCheckoutIssuanceParams(claim, booking.id) ?? requestedParams,
    { idempotencyKey: checkoutIssuanceIdempotencyKey(booking.id, claim) },
  );
  if (!session.url) throw new CheckoutRecoveryError();

  const persisted = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: 'pending',
      cancellationOutcome: null,
      paidAt: null,
      stripeSessionId: null,
      stripeCheckoutSessionId: claim,
    },
    data: {
      stripeSessionId: session.id,
      stripeCheckoutSessionId: session.id,
      priceAmountSek: totals.priceSek,
      serviceFeeSek: totals.serviceFeeSek,
      grossChargedSek: totals.totalSek,
    },
  });
  if (persisted.count === 1) return { url: session.url, stripeSessionId: session.id };

  const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
  // A concurrent retry of the SAME durable claim receives the SAME Stripe
  // session. Never expire that active session merely because its sibling won.
  if (
    fresh &&
    !isCancelled(fresh) &&
    fresh.paymentStatus === 'pending' &&
    fresh.paidAt == null &&
    (fresh.stripeSessionId ?? fresh.stripeCheckoutSessionId) === session.id
  ) {
    return { url: session.url, stripeSessionId: session.id };
  }
  // Fulfillment can also beat persistence after Stripe completes. Expiring its
  // already-held session is unnecessary; the endpoint will return paid state.
  if (fresh?.paidAt != null && !isCancelled(fresh)) throw new CheckoutUnavailableError();

  await expireCheckoutSession(session.id);
  if (fresh && isCancelled(fresh)) {
    const result = await reconcileCancelledCheckoutCapture({
      bookingId: fresh.id,
      sessionId: session.id,
      cancellationOutcome: fresh.cancellationOutcome ?? fresh.paymentStatus,
      cancellationPolicyTier: fresh.cancellationPolicyTier,
      grossChargedSek: fresh.grossChargedSek,
      forceFullRefund: fresh.paidAt == null && fresh.heldAt == null,
    });
    if (
      result.kind === 'error' ||
      result.kind === 'pending' ||
      (result.kind === 'skipped' && result.reason === 'no_payment_intent')
    ) {
      // Do not return a payable URL. The completion webhook remains retriable
      // until its stable refund key succeeds; the claim is retained for audit.
      console.error('[checkout] cancellation capture needs retry', {
        bookingId: fresh.id,
        sessionId: session.id,
        result,
      });
      throw new CheckoutRecoveryError();
    }
  }
  throw new CheckoutUnavailableError();
}
