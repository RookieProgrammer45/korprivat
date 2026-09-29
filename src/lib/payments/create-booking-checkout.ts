// Create a Stripe Checkout Session for a booking (SEK, platform account).
// Shared by POST /api/checkout and instructor accept.

import 'server-only';
import { learnerTotalSek } from '@/lib/business/booking-fees';
import { prisma } from '@/lib/db';
import { resolveOrigin } from '@/lib/payments/origin';
import { getStripe } from '@/lib/payments/stripe';

export class CheckoutConfigurationError extends Error {
  constructor(message = 'Stripe is not configured') {
    super(message);
    this.name = 'CheckoutConfigurationError';
  }
}

export async function createBookingCheckoutSession(input: {
  bookingId: string;
  req: Request;
  /** Optional token appended to success/cancel deep links. */
  accessToken?: string | null;
  userId?: string | null;
}): Promise<{ url: string; stripeSessionId: string }> {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new CheckoutConfigurationError();
  }

  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
  if (!booking) {
    throw new Error('booking_not_found');
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, name: true, hourlyRateSek: true },
  });
  if (!instructor) {
    throw new Error('instructor_not_found');
  }

  const totals =
    booking.priceAmountSek != null &&
    booking.serviceFeeSek != null &&
    booking.grossChargedSek != null
      ? {
          priceSek: booking.priceAmountSek,
          serviceFeeSek: booking.serviceFeeSek,
          totalSek: booking.grossChargedSek,
        }
      : learnerTotalSek(instructor.hourlyRateSek);

  if (
    booking.priceAmountSek == null ||
    booking.serviceFeeSek == null ||
    booking.grossChargedSek == null
  ) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        priceAmountSek: totals.priceSek,
        serviceFeeSek: totals.serviceFeeSek,
        grossChargedSek: totals.totalSek,
      },
    });
  }

  const appUrl = resolveOrigin(input.req).replace(/\/+$/, '');
  const detailPath = `/bookings/${encodeURIComponent(booking.id)}${
    input.accessToken ? `?token=${encodeURIComponent(input.accessToken)}` : ''
  }`;

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'sek',
          unit_amount: totals.totalSek * 100,
          product_data: {
            name: `Betala lektionen — ${instructor.name}`,
          },
        },
      },
    ],
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancelled`,
    metadata: {
      bookingId: booking.id,
      ...(input.userId ? { userId: input.userId } : {}),
      priceSek: String(totals.priceSek),
      serviceFeeSek: String(totals.serviceFeeSek),
      grossChargedSek: String(totals.totalSek),
    },
  });

  if (!session.url) {
    throw new Error('stripe_session_missing_url');
  }

  await prisma.booking.update({
    where: { id: booking.id },
    data: {
      paymentStatus: 'pending',
      stripeSessionId: session.id,
      stripeCheckoutSessionId: session.id,
      priceAmountSek: totals.priceSek,
      serviceFeeSek: totals.serviceFeeSek,
      grossChargedSek: totals.totalSek,
    },
  });

  return { url: session.url, stripeSessionId: session.id };
}
