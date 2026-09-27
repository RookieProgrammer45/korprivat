// The hosted checkout amount is always read from the booking snapshot (or,
// only for a legacy row, stamped from the current instructor rate first).
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { learnerTotalSek } from '@/lib/business/booking-fees';
import { assertTokenMatches } from '@/lib/business/escrow';
import {
  BookingPaymentLinkRequest,
  BookingPaymentLinkResponse,
  type BookingPaymentStatus,
  BookingPaymentStatusEnum,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { resolveOrigin } from '@/lib/payments/origin';
import { getSessionUser } from '@/lib/require-auth';
import {
  createCheckoutSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/client';

export const dynamic = 'force-dynamic';

type PaymentLinkError = 'not_enabled' | 'not_onboarded' | 'unknown';
const TERMINAL_STATES = new Set<BookingPaymentStatus>([
  'paid',
  'held_escrow',
  'released',
  'refunded',
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
  'awaiting_approval',
  'declined',
]);

function safeStatus(value: string | null | undefined): BookingPaymentStatus {
  return BookingPaymentStatusEnum.options.includes(value as BookingPaymentStatus)
    ? (value as BookingPaymentStatus)
    : 'unpaid';
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }

  let payload: unknown = {};
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }
  const parsedPayload = BookingPaymentLinkRequest.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json(
      { errors: { token: 'A valid booking token is required' } },
      { status: 400 },
    );
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, name: true, hourlyRateSek: true, userId: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { id: 'Instructor not found' } }, { status: 404 });
  }

  const suppliedToken = parsedPayload.data.token ?? getBookingAccessToken(req);
  const sessionUser = await getSessionUser();
  const sessionAuthorized =
    sessionUser != null &&
    (booking.userId === sessionUser.id || instructor.userId === sessionUser.id);
  const tokenAuthorized =
    matchesLearnerAccessToken(booking.learnerAccessTokenHash, suppliedToken) ||
    (suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken));
  if (!sessionAuthorized && !tokenAuthorized) {
    return NextResponse.json(
      { errors: { access: 'Booking access is invalid or expired' } },
      { status: 403 },
    );
  }

  const paymentStatus = safeStatus(booking.paymentStatus);
  if (TERMINAL_STATES.has(paymentStatus)) {
    return NextResponse.json(BookingPaymentLinkResponse.parse({ url: null, paymentStatus }), {
      status: 200,
    });
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

  // Stamp legacy rows before minting checkout so the amount used by Stripe
  // and the amount shown after redirect come from the same persisted values.
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

  const origin = resolveOrigin(req);
  const detailUrl = `${origin}/bookings/${encodeURIComponent(booking.id)}${
    suppliedToken ? `?token=${encodeURIComponent(suppliedToken)}` : ''
  }`;

  try {
    const session = await createCheckoutSession({
      amountUsd: sekToUsdChargeAmount(totals.totalSek),
      name: `Betala lektionen — ${instructor.name} (skolans publicerade pris)`,
      successUrl: detailUrl,
      cancelUrl: detailUrl,
      metadata: {
        bookingId: booking.id,
        priceSek: String(totals.priceSek),
        serviceFeeSek: String(totals.serviceFeeSek),
        grossChargedSek: String(totals.totalSek),
      },
    });
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        paymentStatus: 'pending',
        stripeCheckoutSessionId: session.stripeSessionId,
        priceAmountSek: totals.priceSek,
        serviceFeeSek: totals.serviceFeeSek,
        grossChargedSek: totals.totalSek,
      },
    });
    return NextResponse.json(
      BookingPaymentLinkResponse.parse({ url: session.url, paymentStatus: 'pending' }),
      { status: 200 },
    );
  } catch (error) {
    return errorResponse(classifyError(error));
  }
}

function classifyError(error: unknown): PaymentLinkError {
  if (
    error instanceof StripeBillingNotEnabledError ||
    errorName(error) === 'StripeBillingNotEnabledError' ||
    error instanceof StripeBillingConfigurationError ||
    errorName(error) === 'StripeBillingConfigurationError'
  ) {
    return 'not_enabled';
  }
  if (
    error instanceof StripeBillingOnboardingError ||
    errorName(error) === 'StripeBillingOnboardingError'
  ) {
    return 'not_onboarded';
  }
  return 'unknown';
}

function errorName(error: unknown): string | null {
  return error instanceof Error && typeof error.name === 'string' ? error.name : null;
}

function errorResponse(code: PaymentLinkError): Response {
  const status = code === 'not_enabled' ? 403 : code === 'not_onboarded' ? 409 : 500;
  return NextResponse.json({ errors: { payments: code } }, { status });
}
