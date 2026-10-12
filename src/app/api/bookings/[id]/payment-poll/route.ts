// Payment poll: read paidAt / paymentStatus. If still pending and a Stripe
// session id exists, retrieve the session as a self-heal when the webhook has
// not landed. A Stripe `complete` status alone is never payment proof.
import 'server-only';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
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
import { validateBookingCheckoutAmount } from '@/lib/payments/checkout-amount';
import { isCheckoutIssuanceClaim } from '@/lib/payments/checkout-issuance';
import { markBookingPaidFromCheckout } from '@/lib/payments/fulfill-checkout';
import { reconcileCancelledCheckoutCapture } from '@/lib/payments/refunds';
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
    select: { userId: true, email: true, name: true, city: true, hourlyRateSek: true },
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
    const reconciliation = await reconcileCancelledPollCapture(booking);
    if (reconciliation === 'retry') {
      return NextResponse.json(
        { errors: { payments: 'cancelled_capture_reconciliation_pending' } },
        { status: 503 },
      );
    }
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
  if (!sessionId || isCheckoutIssuanceClaim(sessionId)) {
    return pollResponse(
      false,
      safePaymentStatus(booking.paymentStatus),
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }

  let stripeSession: Stripe.Checkout.Session;
  let verifiedAmountSek: number;
  try {
    stripeSession = await getStripe().checkout.sessions.retrieve(sessionId);
    const amount = validateBookingCheckoutAmount({
      currency: stripeSession.currency,
      amountTotal: stripeSession.amount_total,
      grossChargedSek: booking.grossChargedSek,
    });
    if (stripeSession.payment_status !== 'paid' || !amount.ok) {
      return pollResponse(
        false,
        'pending',
        await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
      );
    }
    verifiedAmountSek = amount.amountSek;
  } catch {
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

  if (mark.kind === 'ignored') {
    return pollResponse(
      false,
      'pending',
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }
  if (mark.kind === 'cancelled') {
    const reconciliation = await reconcileCancelledCheckoutCapture({
      bookingId: mark.booking.id,
      sessionId,
      cancellationOutcome: mark.booking.cancellationOutcome ?? mark.booking.paymentStatus,
      cancellationPolicyTier: mark.booking.cancellationPolicyTier,
      grossChargedSek: mark.booking.grossChargedSek,
      forceFullRefund: mark.booking.paidAt == null && mark.booking.heldAt == null,
      session: stripeSession,
    });
    if (
      reconciliation.kind === 'error' ||
      reconciliation.kind === 'pending' ||
      (reconciliation.kind === 'skipped' && reconciliation.reason === 'no_payment_intent')
    ) {
      return NextResponse.json(
        { errors: { payments: 'cancelled_capture_reconciliation_pending' } },
        { status: 503 },
      );
    }
    return pollResponse(
      true,
      safePaymentStatus(mark.booking.paymentStatus),
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }
  if (mark.kind === 'duplicate') {
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    return pollResponse(
      true,
      safePaymentStatus(fresh?.paymentStatus ?? 'held_escrow'),
      await getReceiptEmailDeliveryStatus(booking.id, recipientRole),
    );
  }

  await ensureBookingReceipts({
    booking: { ...booking, slot: booking.bookedSlot, paymentStatus: 'held_escrow' },
    instructor: instructor ?? { name: 'Instructor', city: '', hourlyRateSek: 0 },
    verifiedAmountSek,
  });

  const learnerToken =
    mark.learnerAccessToken ?? (learnerTokenAuthorized ? (suppliedToken ?? undefined) : undefined);
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

async function reconcileCancelledPollCapture(booking: {
  id: string;
  paymentStatus: string | null;
  cancellationOutcome: string | null;
  cancellationPolicyTier: string | null;
  grossChargedSek: number | null;
  paidAt: Date | null;
  heldAt: Date | null;
  refundedAt: Date | null;
  stripeSessionId: string | null;
  stripeCheckoutSessionId: string | null;
}): Promise<'done' | 'retry'> {
  const sessionId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!sessionId || isCheckoutIssuanceClaim(sessionId) || booking.refundedAt) return 'done';
  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') return 'done';
    const result = await reconcileCancelledCheckoutCapture({
      bookingId: booking.id,
      sessionId,
      cancellationOutcome: booking.cancellationOutcome ?? booking.paymentStatus,
      cancellationPolicyTier: booking.cancellationPolicyTier,
      grossChargedSek: booking.grossChargedSek,
      forceFullRefund: booking.paidAt == null && booking.heldAt == null,
      session,
    });
    return result.kind === 'error' ||
      result.kind === 'pending' ||
      (result.kind === 'skipped' && result.reason === 'no_payment_intent')
      ? 'retry'
      : 'done';
  } catch {
    return 'retry';
  }
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
  await ensureBookingReceipts({
    booking: { ...booking, slot: booking.bookedSlot },
    instructor,
    verifiedAmountSek: booking.grossChargedSek ?? 0,
  });
}

function safePaymentStatus(value: string | null | undefined) {
  return BookingPaymentStatusEnum.safeParse(value ?? 'unpaid').success
    ? (value ?? 'unpaid')
    : 'unpaid';
}
