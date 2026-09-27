//
// "Lesson completed" terminal transition for the escrow flow. Either the
// learner or the instructor can mark the lesson done — both carry the same
// per-booking unguessable action token in the deep-link, so the route is
// anonymous and the token is the only auth check.
//
// Fulfill-once: the conditional `where` clause is the race guard. A second
// call with `paymentStatus: 'released'` matches zero rows and is a no-op
// (which becomes a 200 with the original timestamps so idempotent retries
// from the deep-link page resolve cleanly).
//
// Side effect: notify the *other* party (the one who did NOT click). Funds
// are conceptually released to the instructor immediately on this update —
// the actual Stripe side is the operator's task and is communicated in copy.
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { instructorPayoutSek } from '@/lib/business/booking-fees';
import { assertTokenMatches } from '@/lib/business/escrow';
import { syncBookingReceiptStatuses } from '@/lib/business/receipts';
import { BookingCompleteRequest, BookingCompleteResponse } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { lessonCompletedEmail } from '@/lib/email/templates';
import { getSessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingCompleteRequest.safeParse(bodyJson);
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
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { hourlyRateSek: true, userId: true, providerRole: true, email: true, name: true },
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
  const providerSession = sessionUser != null && instructor?.userId === sessionUser.id;
  if (!learnerToken && !providerToken && !learnerSession && !providerSession) {
    return NextResponse.json({ errors: { token: 'Invalid action token' } }, { status: 403 });
  }
  const actorRole: 'learner' | 'instructor' =
    providerSession || providerToken ? 'instructor' : 'learner';
  if (booking.paymentStatus !== 'held_escrow' || booking.disputeStatus === 'open') {
    // Either the funds were never received, or they're locked behind an
    // unresolved dispute. Both reject with 409 — completing from either
    // base is a no-op.
    return NextResponse.json(
      { errors: { state: 'Lesson cannot be completed in this state' } },
      { status: 409 },
    );
  }

  // Compute the instructor payout ONCE for the audit row. The
  // `priceAmountSek` snapshot is the source of truth — a later change to
  // the instructor's `hourlyRateSek` cannot retroactively shift the row's
  // payout. If the snapshot is missing (a pre-feature row that was
  // charged before the FeeModel column shipped), fall back to the live
  // `hourlyRateSek` so legacy rows still release cleanly.
  const priceForPayout = booking.priceAmountSek ?? instructor?.hourlyRateSek ?? 0;
  const payout = instructorPayoutSek(priceForPayout);

  const now = new Date();
  const updateResult = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: 'held_escrow',
      payoutReleasedAt: null,
      disputeStatus: null,
    },
    data: {
      completedAt: now,
      completedByRole: sessionUser
        ? actorRole
        : data.completedByRole === 'instructor'
          ? 'instructor'
          : actorRole,
      completedByLabel: data.completedByLabel,
      payoutReleasedAt: now,
      releasedByRole: sessionUser
        ? actorRole
        : data.completedByRole === 'instructor'
          ? 'instructor'
          : actorRole,
      releasedByLabel: data.completedByLabel,
      paymentStatus: 'released',
      // Per-booking payout audit column — stamped ONCE at release so the
      // operator can reconcile without joining on `instructor.hourlyRateSek`.
      payoutAmountSek: payout.payoutSek,
    },
  });

  if (updateResult.count === 0) {
    // Lost the race OR the row has already settled in some terminal state.
    // Idempotent retry: return the current row's completion timestamps so
    // the caller treats it as success.
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (
      !fresh ||
      fresh.paymentStatus !== 'released' ||
      fresh.completedAt === null ||
      fresh.payoutReleasedAt === null
    ) {
      return NextResponse.json(
        { errors: { state: 'Lesson cannot be completed in this state' } },
        { status: 409 },
      );
    }
    await syncBookingReceiptStatuses(booking.id, 'released', 'released');
    return NextResponse.json(
      BookingCompleteResponse.parse({
        id: fresh.id,
        paymentStatus: 'released',
        completedAt: fresh.completedAt ? fresh.completedAt.toISOString() : null,
        payoutReleasedAt: fresh.payoutReleasedAt ? fresh.payoutReleasedAt.toISOString() : null,
      }),
      { status: 200 },
    );
  }

  await syncBookingReceiptStatuses(booking.id, 'released', 'released');

  await notifyCounterparty({
    booking,
    completedByRole: sessionUser
      ? actorRole
      : data.completedByRole === 'instructor'
        ? 'instructor'
        : actorRole,
    completedByLabel: data.completedByLabel,
    locale: booking.locale === 'en' ? 'en' : 'sv',
  }).catch((_reason) => {});

  return NextResponse.json(
    BookingCompleteResponse.parse({
      id: booking.id,
      paymentStatus: 'released',
      completedAt: now.toISOString(),
      payoutReleasedAt: now.toISOString(),
    }),
    { status: 200 },
  );
}

async function notifyCounterparty(input: {
  booking: { id: string; studentName: string; studentEmail: string; instructorId: string };
  completedByRole: 'learner' | 'instructor';
  completedByLabel: string;
  locale: 'sv' | 'en';
}) {
  const otherRole: 'learner' | 'instructor' =
    input.completedByRole === 'learner' ? 'instructor' : 'learner';
  const instructor = await prisma.instructor.findUnique({
    where: { id: input.booking.instructorId },
    select: { email: true, name: true },
  });

  const recipientEmail =
    otherRole === 'learner' ? input.booking.studentEmail : (instructor?.email ?? null);
  if (!recipientEmail) return;

  const mail = lessonCompletedEmail({
    recipientRole: otherRole,
    completedByLabel: input.completedByLabel,
    bookingId: input.booking.id,
    locale: input.locale,
  });
  await sendEmail({ to: recipientEmail, ...mail });
}
