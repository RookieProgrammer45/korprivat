//
// "Cancel a booking" terminal transition. Authorised by the same per-booking
// unguessable action token the held-receipt email deep-link carries
// (mirrors the complete / dispute pattern). The per-tier classifier in
// `src/lib/business/cancellation-policy` decides between FOUR buckets:
//
//   'full_refund' — outside the tier's `fullRefundBeforeHours` (5 days for
//                   moderate, 7 days for strict, 24h for flexible). Cancel
//                   permitted, NO fee, slot freed,
//                   `cancellationOutcome='cancelled_full_refund'`.
//   'partial'     — between the tier's full-refund window and the 24h
//                   late window. Tier-supplied `partialFeePercent`
//                   (50% for moderate / strict, 0% for flexible). Fee row
//                   recorded; `cancellationOutcome='cancelled_partial'`.
//   'late'        — within LATE_WINDOW_HOURS (24h before the lesson).
//                   100% fee, fee row recorded,
//                   `cancellationOutcome='cancelled_late'`.
//   'past'        — at or after the lesson start; cancel rejected 409 —
//                   the dispute path is the right channel at that point.
//
// The fee is read against the ALREADY-PAID lesson charge
// (`sekToUsdChargeAmount(instructor.hourlyRateSek)`) so a learner who's
// already completed Stripe checkout sees the fee they were already charged,
// in the same currency the checkout page quoted. App code never issues
// Stripe refunds per the stripe-payments skill — the platform-team
// reconciliation cycle sweeps any residual out-of-band; the instructor
// keeps the full lesson rate per the marketplace model.
//
// Fulfill-once: the transaction first claims the booking row, then inserts
// the fee and frees the slot. A losing concurrent call therefore cannot leave
// behind a fee row. If `booking.cancellationOutcome` is already set to any of
// the four cancellation values, the route is short-circuit 200 idempotent.
//
// Side effect: notify the *non*-cancelling party. The learner gets a fee
// receipt (when fee > 0) or a neutral confirmation (full refund). The
// instructor gets the neutral confirmation regardless of outcome (their
// payout is untouched on every path).
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import {
  classifyCancellationOutcome,
  computeCancellationFeeUsd,
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
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { getSessionUser } from '@/lib/require-auth';

// Acceptable base states for a cancel POST — any in-flight state the
// booking might sit before completion:
//   unpaid     — pre-payment; no fee, just frees the slot.
//   pending    — Stripe checkout minted, learner hasn't paid; no fee.
//   paid       — LEGACY pre-escrow state; rare in practice.
//   held_escrow— funds held; the normal case for both early and late.
// `awaiting_approval` (Request-mode row, instructor hasn't answered yet)
// is also a valid base — the learner can withdraw the request.
// A paid-out booking (released / refunded) is past the point where
// cancellation makes sense — the dispute path covers that surface.
const CANCEL_BASE_STATES = [
  'unpaid',
  'pending',
  'paid',
  'held_escrow',
  'awaiting_approval',
] as const;
type CancelBaseState = (typeof CANCEL_BASE_STATES)[number];
// Terminal outcomes this route is allowed to WRITE onto a freshly-
// cancelled booking. Any row arriving here with an already-set
// `cancellationOutcome` is short-circuited via the idempotency block
// BELOW — this is the set the route USES to commit + the idempotency
// block COULD short-circuit.
type TerminalCancellation =
  | 'cancelled_full_refund'
  | 'cancelled_partial'
  | 'cancelled_late'
  | 'cancelled_early';
type PaymentAfter = CancelBaseState | TerminalCancellation;

export const dynamic = 'force-dynamic';

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
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const data = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
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
  // Already-cancelled booking → return the prior outcome (idempotent retry).
  // The four possible values match the four `CancellationOutcomeEnum`
  // entries the cancel flow can write today + the LEGACY `cancelled_early`
  // value (kept on the storage column for historical rows; no new writes
  // target it because the per-tier classifier never maps to it).
  const priorOutcome = booking.cancellationOutcome;
  if (
    priorOutcome === 'cancelled_full_refund' ||
    priorOutcome === 'cancelled_partial' ||
    priorOutcome === 'cancelled_late' ||
    priorOutcome === 'cancelled_early'
  ) {
    await repairPaidCancellationReceipts({
      booking,
      paymentStatus: priorOutcome,
      verifiedAmountUsd: sekToUsdChargeAmount(booking.grossChargedSek ?? 1),
    });
    return NextResponse.json(
      BookingCancelResponse.parse({
        id: booking.id,
        paymentStatus: priorOutcome as PaymentAfter,
        cancellationOutcome: priorOutcome,
        cancelledAt: (booking.cancelledAt ?? new Date()).toISOString(),
        // The fee from the original cancel was retained on the platform; we
        // intentionally DO NOT look it up here — the original response is
        // authoritative for the same-row retry path.
        feeAmountUsd: null,
      }),
      { status: 200 },
    );
  }
  // Pre-flight state guard. Cancellation only applies while the booking
  // is in flight (pending/paid/held_escrow). A released / refunded row has
  // already settled; a 'cancelled_*' row is handled above.
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
  // Per-tier policy lookup — reads the SNAPSHOT on the booking row (set at
  // POST /api/bookings time), NEVER the live instructor tier. Same fallback
  // to 'flexible' that the contract's nullable tier column uses.
  const policy = getPolicyForTier(booking.cancellationPolicyTier);
  const classified = classifyCancellationOutcome(now, booking.preferredAt, policy);
  if (classified.kind === 'past') {
    // Lesson already started — dispute is the right channel.
    return NextResponse.json(
      {
        errors: {
          state:
            'The lesson has already started — to flag a problem with this booking, open a dispute instead.',
        },
      },
      { status: 409 },
    );
  }

  const cancelledByLabel = data.cancelledByLabel;
  // Session ownership is authoritative. For legacy email links the token is
  // the authorization grant; retain the optional role only for old links that
  // used one shared action token for both parties.
  const cancelledByRole: 'learner' | 'instructor' = sessionUser
    ? actorRole
    : (data.cancelledByRole ?? actorRole);
  const outcome: TerminalCancellation =
    classified.kind === 'full_refund'
      ? 'cancelled_full_refund'
      : classified.kind === 'partial'
        ? 'cancelled_partial'
        : 'cancelled_late';
  const paymentStatusAfter: PaymentAfter = outcome;

  // Fee branch — applies for `cancelled_partial` (tier.partialFeePercent)
  // and `cancelled_late` (100%). `cancelled_full_refund` writes no fee.
  let feeAmountUsd: number | null = null;
  let feePercentApplied = 0;

  // Stash the instructor row the fee branch fetched so the repair and email
  // steps can share the same snapshot.
  let feeBranchInstructor: {
    email: string | null;
    name: string;
    city: string;
    hourlyRateSek: number;
  } | null = null;

  if (outcome === 'cancelled_partial' || outcome === 'cancelled_late') {
    const instructor = await prisma.instructor.findUnique({
      where: { id: booking.instructorId },
      select: { hourlyRateSek: true, name: true, email: true, city: true },
    });
    if (!instructor) {
      return NextResponse.json({ errors: { id: 'Instructor not found' } }, { status: 404 });
    }
    feePercentApplied = classified.feePercent;
    const lessonChargeUsd = sekToUsdChargeAmount(instructor.hourlyRateSek);
    feeAmountUsd = computeCancellationFeeUsd(lessonChargeUsd, feePercentApplied);
    feeBranchInstructor = instructor;
  }

  const transactionResult = await prisma.$transaction(async (tx) => {
    const bookingUpdate = await tx.booking.updateMany({
      where: {
        id: booking.id,
        cancellationOutcome: null,
        paymentStatus: { in: [...CANCEL_BASE_STATES] },
      },
      data: {
        paymentStatus: paymentStatusAfter,
        cancellationOutcome: outcome,
        cancelledAt: now,
        cancelledByRole,
        cancelledByLabel,
      },
    });

    if (bookingUpdate.count === 0) return { bookingUpdate };

    if (feeAmountUsd !== null) {
      await tx.lateCancellationFee.create({
        data: {
          bookingId: booking.id,
          amountUsd: feeAmountUsd,
          windowHoursAtCancel: hoursUntilLesson(now, booking.preferredAt),
          feePercentApplied,
          status: 'recorded',
        },
      });
    }

    await tx.availabilitySlot.updateMany({
      where: { bookedBookingId: booking.id },
      data: { bookedAt: null, bookedBookingId: null },
    });

    return { bookingUpdate };
  });
  const bookingUpdate = transactionResult.bookingUpdate;

  if (bookingUpdate.count === 0) {
    // Concurrent cancel won — return its outcome so the caller doesn't
    // see a phantom failure.
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (fresh?.cancellationOutcome) {
      return NextResponse.json(
        BookingCancelResponse.parse({
          id: fresh.id,
          paymentStatus: (fresh.paymentStatus ?? outcome) as PaymentAfter,
          cancellationOutcome: fresh.cancellationOutcome,
          cancelledAt: (fresh.cancelledAt ?? now).toISOString(),
          feeAmountUsd:
            fresh.cancellationOutcome === 'cancelled_late' ||
            fresh.cancellationOutcome === 'cancelled_partial'
              ? feeAmountUsd
              : null,
        }),
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        errors: {
          state: 'Cancellation state changed underneath — refresh and try again.',
        },
      },
      { status: 409 },
    );
  }

  // Validate back through the enum so a refactor that drops a value out
  // of `CancellationOutcomeEnum` surfaces as a parse error here, not a
  // silently-wrong response shape downstream.
  const parsedOutcome = CancellationOutcomeEnum.parse(outcome);
  const responseBody = BookingCancelResponse.parse({
    id: booking.id,
    paymentStatus: paymentStatusAfter,
    cancellationOutcome: parsedOutcome,
    cancelledAt: now.toISOString(),
    feeAmountUsd,
  });

  const cancellationInstructor =
    feeBranchInstructor ??
    (await prisma.instructor.findUnique({
      where: { id: booking.instructorId },
      select: { email: true, name: true, city: true, hourlyRateSek: true },
    }));
  await repairPaidCancellationReceipts({
    booking,
    instructor: cancellationInstructor,
    paymentStatus: paymentStatusAfter,
    verifiedAmountUsd: sekToUsdChargeAmount(
      booking.grossChargedSek ?? cancellationInstructor?.hourlyRateSek ?? 1,
    ),
  });

  // Fire side-effect emails — failure of either side does NOT block the
  // successful return; the booking is already in its terminal state.
  await notifyAfterCancel({
    booking: {
      id: booking.id,
      studentName: booking.studentName,
      studentEmail: booking.studentEmail,
      instructorId: booking.instructorId,
    },
    cancelledByRole,
    cancelledByLabel,
    outcome,
    feeAmountUsd,
    feePercentApplied,
    feeBranchInstructor: cancellationInstructor,
    locale: booking.locale === 'en' ? 'en' : 'sv',
  }).catch((_reason) => {});

  return NextResponse.json(responseBody, { status: 200 });
}

async function notifyAfterCancel(input: {
  booking: {
    id: string;
    studentName: string;
    studentEmail: string;
    instructorId: string;
  };
  cancelledByRole: 'learner' | 'instructor';
  cancelledByLabel: string;
  outcome: TerminalCancellation;
  feeAmountUsd: number | null;
  feePercentApplied: number;
  feeBranchInstructor: {
    email: string | null;
    name: string;
    hourlyRateSek: number;
  } | null;
  locale: 'sv' | 'en';
}) {
  // The fee branch already fetched the instructor row (needed for the
  // USD/sec computation); reuse it. On the no-fee branch (`full_refund`)
  // we fetch the row here — same shape, same select set.
  const instructorRow =
    input.feeBranchInstructor ??
    (await prisma.instructor.findUnique({
      where: { id: input.booking.instructorId },
      select: { email: true, name: true, hourlyRateSek: true },
    }));
  const finalInstructorName = instructorRow?.name ?? 'din instruktör';

  // The learner gets the fee receipt when the cancel carried ANY fee —
  // partial (50%) or full (100%). They get the neutral confirmation only
  // when no fee was recorded (`cancelled_full_refund` / LEGACY
  // `cancelled_early`).
  const feeAmountUsd: number | null = input.feeAmountUsd;
  const hasFee = feeAmountUsd !== null && feeAmountUsd > 0;
  const learnerMail =
    hasFee && instructorRow && feeAmountUsd !== null
      ? cancellationFeeReceiptEmail({
          recipientName: input.booking.studentName,
          instructorName: finalInstructorName,
          feeUsd: feeAmountUsd,
          lessonChargeUsd: sekToUsdChargeAmount(instructorRow.hourlyRateSek),
          bookingId: input.booking.id,
          // Pass through the percent so the receipt email phrases a
          // partial-fee cancel as "{X}% fee per your instructor's policy"
          // when the cancel is partial (e.g. 50% on moderate / strict).
          feePercent: input.feePercentApplied,
          locale: input.locale,
        })
      : cancellationNeutralEmail({
          recipientRole: 'learner',
          recipientName: input.booking.studentName,
          otherPartyName: finalInstructorName,
          bookingId: input.booking.id,
          locale: input.locale,
        });
  const sendTasks: Array<Promise<void>> = [
    sendEmail({ to: input.booking.studentEmail, ...learnerMail }).then(() => undefined),
  ];
  if (instructorRow?.email) {
    // The instructor gets the SAME neutral notification regardless of
    // outcome (their payout is untouched on all four paths — full_refund
    // has no fee, partial + late retain the fee on the platform-side
    // residual and still release the lesson rate in full per the
    // marketplace model).
    const instructorMail = cancellationNeutralEmail({
      recipientRole: 'instructor',
      recipientName: instructorRow.name,
      otherPartyName: input.booking.studentName,
      bookingId: input.booking.id,
      locale: input.locale,
    });
    sendTasks.push(sendEmail({ to: instructorRow.email, ...instructorMail }).then(() => undefined));
  }
  await Promise.allSettled(sendTasks);
}
