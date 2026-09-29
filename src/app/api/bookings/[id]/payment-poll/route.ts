//
// Payment poll: read paidAt / paymentStatus. If still pending and a Stripe
// session id exists, retrieve the session from Stripe as a self-heal when
// the webhook hasn't landed yet. Receipt delivery stays best-effort.
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import { recordRebookingContext } from '@/lib/business/rebooking-cache';
import {
  deliverBookingReceipt,
  getReceiptEmailDeliveryStatus,
} from '@/lib/business/receipt-delivery';
import { ensureBookingReceipts } from '@/lib/business/receipts';
import { BookingPaymentPollResponse, BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { markBookingPaidFromCheckout } from '@/lib/payments/fulfill-checkout';
import { getStripe } from '@/lib/payments/stripe';
import { getSessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const TERMINAL_PAYMENT_STATES = ['held_escrow', 'released', 'refunded'] as const;
const LEGACY_PAID_STATE = 'paid' as const;
const CANCEL_TERMINAL_STATES = [
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
] as const;
const AWAITING_STATES = ['awaiting_approval', 'declined'] as const;

type ReceiptRole = 'learner' | 'instructor';

type BookingWithSlot = Awaited<ReturnType<typeof prisma.booking.findUnique>>;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: { bookedSlot: { select: { startsAt: true, durationMinutes: true } } },
  });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: {
      userId: true,
      email: true,
      name: true,
      city: true,
      hourlyRateSek: true,
    },
  });
  const sessionUser = await getSessionUser();
  const suppliedToken = getBookingAccessToken(req);
  const learnerTokenAuthorized = matchesLearnerAccessToken(
    booking.learnerAccessTokenHash,
    suppliedToken,
  );
  const instructorTokenAuthorized =
    suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken);
  const recipientRole: ReceiptRole | null =
    sessionUser?.id === booking.userId
      ? 'learner'
      : sessionUser?.id && sessionUser.id === instructor?.userId
        ? 'instructor'
        : learnerTokenAuthorized
          ? 'learner'
          : instructorTokenAuthorized
            ? 'instructor'
            : null;
  if (!recipientRole) {
    return NextResponse.json(
      { errors: { access: 'Booking access is invalid or expired' } },
      { status: 403 },
    );
  }

  if (
    CANCEL_TERMINAL_STATES.includes(
      booking.paymentStatus as (typeof CANCEL_TERMINAL_STATES)[number],
    )
  ) {
    return pollResponse(
      true,
      booking.paymentStatus as (typeof CANCEL_TERMINAL_STATES)[number],
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }
  if (AWAITING_STATES.includes(booking.paymentStatus as (typeof AWAITING_STATES)[number])) {
    return pollResponse(
      true,
      booking.paymentStatus as (typeof AWAITING_STATES)[number],
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }
  if (
    booking.paidAt != null ||
    booking.paymentStatus === LEGACY_PAID_STATE ||
    TERMINAL_PAYMENT_STATES.includes(
      booking.paymentStatus as (typeof TERMINAL_PAYMENT_STATES)[number],
    )
  ) {
    await repairReceiptSnapshots(booking, instructor);
    const delivery = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole,
      req,
      learnerAccessToken: learnerTokenAuthorized ? (suppliedToken ?? undefined) : undefined,
    });
    return pollResponse(
      true,
      (booking.paymentStatus as 'paid' | 'held_escrow' | 'released' | 'refunded') ?? 'held_escrow',
      delivery.status,
    );
  }

  const sessionId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!sessionId) {
    return pollResponse(
      false,
      safePaymentStatus(booking.paymentStatus),
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }

  // Self-heal: if webhook hasn't marked paid yet, ask Stripe.
  let paid = false;
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    paid = session.payment_status === 'paid' || session.status === 'complete';
  } catch {
    return pollResponse(
      false,
      'pending',
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }
  if (!paid) {
    return pollResponse(
      false,
      'pending',
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }

  const mark = await markBookingPaidFromCheckout({
    bookingId: booking.id,
    stripeSessionId: sessionId,
    preserveLearnerToken: learnerTokenAuthorized,
  });

  if (mark.duplicate) {
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    return pollResponse(
      true,
      safePaymentStatus(fresh?.paymentStatus ?? 'held_escrow'),
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }

  const verifiedAmountUsd = sekToUsdChargeAmount(booking.grossChargedSek ?? 1);
  await ensureBookingReceipts({
    booking: { ...booking, slot: booking.bookedSlot, paymentStatus: 'held_escrow' },
    instructor: instructor ?? {
      name: 'Instructor',
      city: '',
      hourlyRateSek: 0,
    },
    verifiedAmountUsd,
  });

  const learnerToken =
    mark.learnerAccessToken ??
    (learnerTokenAuthorized ? (suppliedToken ?? undefined) : undefined);
  const deliveryBooking = {
    id: booking.id,
    studentName: booking.studentName,
    studentEmail: booking.studentEmail,
    instructorId: booking.instructorId,
    actionToken: mark.actionToken,
    learnerAccessTokenHash: booking.learnerAccessTokenHash,
    instructor: instructor ? { email: instructor.email, name: instructor.name } : null,
  };
  const [learnerDelivery, instructorDelivery] = await Promise.all([
    deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req,
      learnerAccessToken: learnerToken,
      booking: deliveryBooking,
    }),
    deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'instructor',
      req,
      booking: deliveryBooking,
    }),
  ]);
  const callerDelivery = recipientRole === 'learner' ? learnerDelivery : instructorDelivery;

  if (sessionUser?.id && booking.userId === sessionUser.id) {
    await recordRebookingContext({
      userId: sessionUser.id,
      instructorId: booking.instructorId,
      category: booking.category,
      studentName: booking.studentName,
      studentPhone: booking.studentPhone,
      lastBookingId: booking.id,
    });
  }

  return pollResponse(true, 'held_escrow', callerDelivery.status);
}

function pollResponse(
  verified: boolean,
  paymentStatus: string,
  receiptEmailStatus: 'pending' | 'sending' | 'sent' | 'failed' | null,
) {
  return NextResponse.json(
    BookingPaymentPollResponse.parse({ verified, paymentStatus, receiptEmailStatus }),
    { status: 200 },
  );
}

async function repairReceiptSnapshots(
  booking: Exclude<BookingWithSlot, null> & {
    bookedSlot?: { startsAt: Date; durationMinutes: number } | null;
  },
  instructor: {
    userId: string | null;
    name: string;
    city: string;
    hourlyRateSek: number;
  } | null,
) {
  if (!instructor) return;
  const existing = await prisma.bookingReceipt.findMany({
    where: { bookingId: booking.id },
    select: { id: true },
  });
  if (existing.length >= 2) return;
  const verifiedAmountUsd = sekToUsdChargeAmount(booking.grossChargedSek ?? 1);
  await ensureBookingReceipts({
    booking: { ...booking, slot: booking.bookedSlot },
    instructor,
    verifiedAmountUsd,
  });
}

function safePaymentStatus(value: string | null | undefined) {
  return BookingPaymentStatusEnum.safeParse(value ?? 'unpaid').success
    ? (value ?? 'unpaid')
    : 'unpaid';
}
