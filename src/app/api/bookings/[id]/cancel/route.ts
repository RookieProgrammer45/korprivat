// Terminal booking cancellation. The database CAS is intentionally short; all
// Stripe calls happen after the terminal commit and are idempotently reconciled.
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import {
  classifyCancellationOutcome,
  computeCancellationFeeSek,
  getPolicyForTier,
  hoursUntilLesson,
} from '@/lib/business/cancellation-policy';
import { assertTokenMatches } from '@/lib/business/escrow';
import { repairPaidCancellationReceipts } from '@/lib/business/receipts';
import {
  BookingCancelRequest,
  BookingCancelResponse,
  CancellationOutcomeEnum,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { cancellationFeeReceiptEmail, cancellationNeutralEmail } from '@/lib/email/templates';
import { isCheckoutIssuanceClaim } from '@/lib/payments/checkout-issuance';
import { recoverCancelledCheckoutIssuance } from '@/lib/payments/checkout-issuance-recovery';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import {
  alertReleasedCancelNeedsReview,
  reconcileCancelledCheckoutCapture,
} from '@/lib/payments/refunds';
import { getStripe } from '@/lib/payments/stripe';
import { getSessionUser } from '@/lib/require-auth';

const CANCEL_BASE_STATES = [
  'unpaid',
  'pending',
  'paid',
  'held_escrow',
  'awaiting_approval',
] as const;
type CancelBaseState = (typeof CANCEL_BASE_STATES)[number];
type TerminalCancellation =
  | 'cancelled_full_refund'
  | 'cancelled_partial'
  | 'cancelled_late'
  | 'cancelled_early';
type PaymentAfter = CancelBaseState | TerminalCancellation;

type BookingSnapshot = NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>>;
type CancellationPlan = { captured: boolean; feeAmountSek: number; feePercentApplied: number };

export const dynamic = 'force-dynamic';

function isTerminalCancellation(value: string | null | undefined): value is TerminalCancellation {
  return (
    value === 'cancelled_full_refund' ||
    value === 'cancelled_partial' ||
    value === 'cancelled_late' ||
    value === 'cancelled_early'
  );
}

function isCapturedStatus(value: string | null | undefined) {
  return value === 'paid' || value === 'held_escrow';
}

async function hasCapturedPaymentEvidence(booking: BookingSnapshot): Promise<boolean> {
  if (booking.paidAt != null || booking.heldAt != null || isCapturedStatus(booking.paymentStatus)) {
    return true;
  }
  // Older schema revisions used a payment-intent field. Read it defensively so
  // a deployed client generated from that schema remains correctly recognized.
  if (
    'stripePaymentIntentId' in booking &&
    typeof (booking as unknown as { stripePaymentIntentId?: unknown }).stripePaymentIntentId ===
      'string'
  ) {
    return true;
  }
  // A pre-existing receipt is historical evidence of payment; do not infer
  // payment from a payout snapshot or from a pending Checkout Session.
  const receipts = await prisma.bookingReceipt.findMany({
    where: { bookingId: booking.id },
    select: { id: true },
    take: 1,
  });
  return receipts.length > 0;
}

async function cancellationPlan(
  booking: BookingSnapshot,
  outcome: TerminalCancellation,
): Promise<CancellationPlan | 'legacy_support_required'> {
  const captured = await hasCapturedPaymentEvidence(booking);
  if (!captured || outcome === 'cancelled_full_refund' || outcome === 'cancelled_early') {
    return { captured, feeAmountSek: 0, feePercentApplied: 0 };
  }
  if (booking.grossChargedSek == null) return 'legacy_support_required';
  const feePercentApplied =
    outcome === 'cancelled_late'
      ? 100
      : getPolicyForTier(booking.cancellationPolicyTier).partialFeePercent;
  return {
    captured,
    feeAmountSek: computeCancellationFeeSek(booking.grossChargedSek, feePercentApplied),
    feePercentApplied,
  };
}

function responseFor(
  booking: BookingSnapshot,
  outcome: TerminalCancellation,
  feeAmountSek: number,
  reconciliationPending = false,
): ReturnType<typeof BookingCancelResponse.parse> {
  return BookingCancelResponse.parse({
    id: booking.id,
    paymentStatus: outcome as PaymentAfter,
    cancellationOutcome: CancellationOutcomeEnum.parse(outcome),
    cancelledAt: (booking.cancelledAt ?? new Date()).toISOString(),
    feeAmountSek,
    reconciliationPending,
  });
}

async function expireCheckoutSession(sessionId: string, bookingId: string) {
  try {
    await getStripe().checkout.sessions.expire(sessionId);
  } catch (error) {
    // Completion/expiry races are expected. We always retrieve/reconcile below,
    // so an expiration error is never used as proof that no money was captured.
    console.warn('[cancel] unable to expire Checkout Session', {
      bookingId,
      checkoutSessionId: sessionId,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }
}

async function reconcileCancelledSession(
  booking: BookingSnapshot,
  plan: CancellationPlan,
): Promise<'done' | 'retry'> {
  let sessionId = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!sessionId) return 'done';
  if (isCheckoutIssuanceClaim(sessionId)) {
    try {
      if ((await recoverCancelledCheckoutIssuance(booking.id)) !== 'recovered') return 'retry';
      const recovered = await prisma.booking.findUnique({ where: { id: booking.id } });
      sessionId = recovered?.stripeSessionId ?? recovered?.stripeCheckoutSessionId ?? null;
      if (!sessionId || isCheckoutIssuanceClaim(sessionId)) return 'retry';
    } catch {
      return 'retry';
    }
  }
  await expireCheckoutSession(sessionId, booking.id);
  const result = await reconcileCancelledCheckoutCapture({
    bookingId: booking.id,
    sessionId,
    cancellationOutcome: booking.cancellationOutcome ?? booking.paymentStatus,
    cancellationPolicyTier: booking.cancellationPolicyTier,
    grossChargedSek: booking.grossChargedSek,
    // A pending/unpaid withdrawal never retains a fee merely because Checkout
    // captured after the terminal cancellation commit.
    forceFullRefund: !plan.captured,
  });
  if (
    result.kind === 'error' ||
    result.kind === 'pending' ||
    (result.kind === 'skipped' && result.reason === 'no_payment_intent')
  ) {
    console.error('[cancel] capture reconciliation requires retry', {
      bookingId: booking.id,
      result,
    });
    return 'retry';
  }
  return 'done';
}

async function loadCancellationInstructor(booking: BookingSnapshot) {
  return prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { userId: true, email: true, name: true, city: true, hourlyRateSek: true },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingCancelRequest.safeParse(bodyJson);
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(parsed.error.flatten().fieldErrors)) {
      if (messages?.[0]) errors[field] = messages[0];
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const data = parsed.data;

  const initialBooking = await prisma.booking.findUnique({ where: { id } });
  if (!initialBooking)
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  let booking: BookingSnapshot = initialBooking;

  const instructorForAccess = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { userId: true, providerRole: true },
  });
  const sessionUser = await getSessionUser();
  const suppliedToken = data.token ?? getBookingAccessToken(req);
  const learnerToken = matchesLearnerAccessToken(booking.learnerAccessTokenHash, suppliedToken);
  const providerToken =
    suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken);
  const learnerSession =
    sessionUser != null &&
    (booking.userId === sessionUser.id ||
      booking.studentEmail.trim().toLowerCase() === sessionUser.email.trim().toLowerCase());
  const providerSession = sessionUser != null && instructorForAccess?.userId === sessionUser.id;
  if (!learnerToken && !providerToken && !learnerSession && !providerSession) {
    return NextResponse.json({ errors: { token: 'Invalid action token' } }, { status: 403 });
  }
  const actorRole: 'learner' | 'instructor' =
    providerSession || providerToken ? 'instructor' : 'learner';

  if (isTerminalCancellation(booking.cancellationOutcome)) {
    const priorPlan = await cancellationPlan(booking, booking.cancellationOutcome);
    if (priorPlan === 'legacy_support_required') {
      return NextResponse.json(
        { errors: { state: 'Cancellation requires support review for this historical booking.' } },
        { status: 409 },
      );
    }
    if (priorPlan.captured && booking.grossChargedSek != null) {
      const instructor = await loadCancellationInstructor(booking);
      await repairPaidCancellationReceipts({
        booking,
        instructor,
        paymentStatus: booking.cancellationOutcome,
        verifiedAmountSek: booking.grossChargedSek,
      });
    }
    const reconciliation = await reconcileCancelledSession(booking, priorPlan);
    return NextResponse.json(
      responseFor(
        booking,
        booking.cancellationOutcome,
        priorPlan.feeAmountSek,
        reconciliation === 'retry',
      ),
      { status: reconciliation === 'done' ? 200 : 202 },
    );
  }

  if (booking.paymentStatus === 'released') {
    await alertReleasedCancelNeedsReview(booking.id).catch(() => undefined);
    return NextResponse.json(
      {
        errors: {
          state: 'This lesson was already paid out. Support has been notified to review a refund.',
        },
      },
      { status: 409 },
    );
  }
  if (
    !booking.paymentStatus ||
    !(CANCEL_BASE_STATES as readonly string[]).includes(booking.paymentStatus)
  ) {
    return NextResponse.json(
      {
        errors: {
          state:
            'Cancellation is only available while the booking is awaiting payment, paid, or held in escrow.',
        },
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const classified = classifyCancellationOutcome(
    now,
    booking.preferredAt,
    getPolicyForTier(booking.cancellationPolicyTier),
  );
  if (classified.kind === 'past') {
    return NextResponse.json(
      { errors: { state: 'The lesson has already started — open a dispute instead.' } },
      { status: 409 },
    );
  }
  const outcome: TerminalCancellation =
    classified.kind === 'full_refund'
      ? 'cancelled_full_refund'
      : classified.kind === 'partial'
        ? 'cancelled_partial'
        : 'cancelled_late';
  const cancelledByRole: 'learner' | 'instructor' = sessionUser
    ? actorRole
    : (data.cancelledByRole ?? actorRole);

  let plan = await cancellationPlan(booking, outcome);
  if (plan === 'legacy_support_required') {
    return NextResponse.json(
      { errors: { state: 'Cancellation requires support review for this historical booking.' } },
      { status: 409 },
    );
  }

  const commit = async (snapshot: BookingSnapshot, currentPlan: CancellationPlan) =>
    prisma.$transaction(async (tx) => {
      const claimed = await tx.booking.updateMany({
        where: {
          id: snapshot.id,
          cancellationOutcome: null,
          paymentStatus: snapshot.paymentStatus,
          paidAt: snapshot.paidAt,
        },
        data: {
          paymentStatus: outcome,
          cancellationOutcome: outcome,
          cancelledAt: now,
          cancelledByRole,
          cancelledByLabel: data.cancelledByLabel,
        },
      });
      if (claimed.count !== 1) return false;
      if (currentPlan.captured && currentPlan.feeAmountSek > 0) {
        await tx.lateCancellationFee.create({
          data: {
            bookingId: snapshot.id,
            // The column is legacy USD compatibility storage. The authoritative
            // client/API value remains feeAmountSek from this frozen snapshot.
            amountUsd: sekToUsdChargeAmount(currentPlan.feeAmountSek),
            amountSek: currentPlan.feeAmountSek,
            windowHoursAtCancel: hoursUntilLesson(now, snapshot.preferredAt),
            feePercentApplied: currentPlan.feePercentApplied,
            status: 'recorded',
          },
        });
      }
      await tx.availabilitySlot.updateMany({
        where: { bookedBookingId: snapshot.id },
        data: { bookedAt: null, bookedBookingId: null },
      });
      return true;
    });

  let committed = await commit(booking, plan);
  if (!committed) {
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (!fresh) return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
    booking = fresh;
    if (isTerminalCancellation(booking.cancellationOutcome)) {
      const priorPlan = await cancellationPlan(booking, booking.cancellationOutcome);
      if (priorPlan === 'legacy_support_required') {
        return NextResponse.json(
          {
            errors: { state: 'Cancellation requires support review for this historical booking.' },
          },
          { status: 409 },
        );
      }
      const reconciliation = await reconcileCancelledSession(booking, priorPlan);
      return NextResponse.json(
        responseFor(
          booking,
          booking.cancellationOutcome,
          priorPlan.feeAmountSek,
          reconciliation === 'retry',
        ),
        {
          status: reconciliation === 'done' ? 200 : 202,
        },
      );
    }
    // Capture won our first CAS. Retry against the actual captured snapshot so
    // a frozen fee/refund is calculated once and reconciliation is triggered.
    if (isCapturedStatus(booking.paymentStatus)) {
      plan = await cancellationPlan(booking, outcome);
      if (plan === 'legacy_support_required') {
        return NextResponse.json(
          {
            errors: { state: 'Cancellation requires support review for this historical booking.' },
          },
          { status: 409 },
        );
      }
      committed = await commit(booking, plan);
    }
    if (!committed) {
      return NextResponse.json(
        { errors: { state: 'Cancellation state changed underneath — refresh and try again.' } },
        { status: 409 },
      );
    }
  }

  const latestReferences = await prisma.booking.findUnique({
    where: { id: booking.id },
    select: { stripeSessionId: true, stripeCheckoutSessionId: true },
  });
  const committedBooking = {
    ...booking,
    ...(latestReferences
      ? {
          stripeSessionId: latestReferences.stripeSessionId,
          stripeCheckoutSessionId: latestReferences.stripeCheckoutSessionId,
        }
      : {}),
    cancellationOutcome: outcome,
    paymentStatus: outcome,
    cancelledAt: now,
  };
  const instructor = await loadCancellationInstructor(booking);
  if (plan.captured && booking.grossChargedSek != null) {
    await repairPaidCancellationReceipts({
      booking: committedBooking,
      instructor,
      paymentStatus: outcome,
      verifiedAmountSek: booking.grossChargedSek,
    });
  }

  const reconciliation = await reconcileCancelledSession(committedBooking, plan);

  await notifyAfterCancel({
    booking: {
      id: booking.id,
      studentName: booking.studentName,
      studentEmail: booking.studentEmail,
      instructorId: booking.instructorId,
      grossChargedSek: booking.grossChargedSek,
    },
    cancelledByRole,
    cancelledByLabel: data.cancelledByLabel,
    outcome,
    feeAmountSek: plan.feeAmountSek,
    feePercentApplied: plan.feePercentApplied,
    instructor,
    locale: booking.locale === 'en' ? 'en' : 'sv',
  }).catch(() => undefined);

  return NextResponse.json(
    responseFor(committedBooking, outcome, plan.feeAmountSek, reconciliation === 'retry'),
    {
      status: reconciliation === 'done' ? 200 : 202,
    },
  );
}

async function notifyAfterCancel(input: {
  booking: {
    id: string;
    studentName: string;
    studentEmail: string;
    instructorId: string;
    grossChargedSek: number | null;
  };
  cancelledByRole: 'learner' | 'instructor';
  cancelledByLabel: string;
  outcome: TerminalCancellation;
  feeAmountSek: number;
  feePercentApplied: number;
  instructor: { email: string | null; name: string; city: string; hourlyRateSek: number } | null;
  locale: 'sv' | 'en';
}) {
  const instructor =
    input.instructor ??
    (await prisma.instructor.findUnique({
      where: { id: input.booking.instructorId },
      select: { email: true, name: true, city: true, hourlyRateSek: true },
    }));
  const instructorName = instructor?.name ?? 'din instruktör';
  const hasFee = input.feeAmountSek > 0;
  const learnerMail =
    hasFee && instructor
      ? cancellationFeeReceiptEmail({
          recipientName: input.booking.studentName,
          instructorName,
          feeSek: input.feeAmountSek,
          lessonChargeSek: input.booking.grossChargedSek ?? input.feeAmountSek,
          bookingId: input.booking.id,
          feePercent: input.feePercentApplied,
          locale: input.locale,
        })
      : cancellationNeutralEmail({
          recipientRole: 'learner',
          recipientName: input.booking.studentName,
          otherPartyName: instructorName,
          bookingId: input.booking.id,
          locale: input.locale,
        });
  const notifications: Array<Promise<void>> = [
    sendEmail({ to: input.booking.studentEmail, ...learnerMail }).then(() => undefined),
  ];
  if (instructor?.email) {
    const instructorMail = cancellationNeutralEmail({
      recipientRole: 'instructor',
      recipientName: instructor.name,
      otherPartyName: input.booking.studentName,
      bookingId: input.booking.id,
      locale: input.locale,
    });
    notifications.push(
      sendEmail({ to: instructor.email, ...instructorMail }).then(() => undefined),
    );
  }
  await Promise.allSettled(notifications);
}
