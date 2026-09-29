// POST /api/checkout — mint a Stripe Checkout Session for a booking.
// GET  /api/checkout?session_id= — poll paidAt for the success page.
//
// Auth: signed-in owner (learner or instructor) OR booking access token
// (same rules as the former payment-link route).

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import {
  BookingPaymentLinkResponse,
  type BookingPaymentStatus,
  BookingPaymentStatusEnum,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import {
  CheckoutConfigurationError,
  createBookingCheckoutSession,
} from '@/lib/payments/create-booking-checkout';
import { getSessionUser, requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const checkoutBodySchema = z.object({
  bookingId: z.string().min(1),
  token: z.string().min(1).optional(),
});

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

export async function GET(req: Request) {
  const sessionId = new URL(req.url).searchParams.get('session_id')?.trim() ?? '';
  if (!sessionId) {
    return NextResponse.json({ verified: false, error: 'missing_session_id' }, { status: 400 });
  }

  const booking = await prisma.booking.findFirst({
    where: {
      OR: [{ stripeSessionId: sessionId }, { stripeCheckoutSessionId: sessionId }],
    },
    select: { paidAt: true, paymentStatus: true, id: true },
  });

  if (!booking) {
    return NextResponse.json({ verified: false, paymentStatus: null }, { status: 200 });
  }

  const verified =
    booking.paidAt != null ||
    booking.paymentStatus === 'held_escrow' ||
    booking.paymentStatus === 'released' ||
    booking.paymentStatus === 'paid';

  return NextResponse.json({
    verified,
    paymentStatus: booking.paymentStatus,
    bookingId: booking.id,
  });
}

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ errors: { bookingId: 'bookingId is required' } }, { status: 400 });
  }

  const { bookingId, token: bodyToken } = parsed.data;
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, userId: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { id: 'Instructor not found' } }, { status: 404 });
  }

  const suppliedToken = bodyToken ?? getBookingAccessToken(req);
  let sessionUser = await getSessionUser();

  // Prefer requireAuth when no token — matches Phase 2 curl: no session → 401.
  if (!sessionUser && !suppliedToken) {
    try {
      sessionUser = await requireAuth(req);
    } catch (res) {
      return res as Response;
    }
  }

  if (sessionUser && sessionUser.emailVerified === false) {
    return NextResponse.json({ errors: { email: 'email_not_verified' } }, { status: 403 });
  }

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
  if (booking.paidAt != null || TERMINAL_STATES.has(paymentStatus)) {
    return NextResponse.json(BookingPaymentLinkResponse.parse({ url: null, paymentStatus }), {
      status: 200,
    });
  }

  try {
    const session = await createBookingCheckoutSession({
      bookingId: booking.id,
      req,
      accessToken: suppliedToken,
      userId: sessionUser?.id ?? booking.userId,
    });
    return NextResponse.json(
      BookingPaymentLinkResponse.parse({ url: session.url, paymentStatus: 'pending' }),
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof CheckoutConfigurationError) {
      return NextResponse.json({ errors: { payments: 'not_enabled' } }, { status: 403 });
    }
    console.error('[checkout] create failed', error);
    return NextResponse.json({ errors: { payments: 'unknown' } }, { status: 500 });
  }
}
