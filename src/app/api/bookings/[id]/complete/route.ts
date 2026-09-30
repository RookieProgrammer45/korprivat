//
// "Lesson completed" terminal transition for the escrow flow. Either the
// learner or the instructor can mark the lesson done — both carry the same
// per-booking unguessable action token in the deep-link, so the route is
// anonymous and the token is the only auth check.
//
// Payout: awaits Stripe Connect transfer via payoutBooking. On success the
// booking flips held_escrow → released and completedAt is stamped. On
// Connect/transfer failure the row stays held_escrow with completedAt null
// (fail-closed). Counterparty email runs in after().

import 'server-only';
import { after, NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import { syncBookingReceiptStatuses } from '@/lib/business/receipts';
import { BookingCompleteRequest, BookingCompleteResponse } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { lessonCompletedEmail } from '@/lib/email/templates';
import { payoutBooking } from '@/lib/payments/payouts';
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
  const completedByRole: 'learner' | 'instructor' = sessionUser
    ? actorRole
    : data.completedByRole === 'instructor'
      ? 'instructor'
      : actorRole;
  const completedByLabel = data.completedByLabel;

  // Idempotent: already released with completedAt → success without re-transfer.
  if (
    booking.paymentStatus === 'released' &&
    booking.completedAt != null &&
    booking.payoutReleasedAt != null
  ) {
    await syncBookingReceiptStatuses(booking.id, 'released', 'released');
    return NextResponse.json(
      BookingCompleteResponse.parse({
        id: booking.id,
        paymentStatus: 'released',
        completedAt: booking.completedAt.toISOString(),
        payoutReleasedAt: booking.payoutReleasedAt.toISOString(),
      }),
      { status: 200 },
    );
  }

  if (booking.paymentStatus !== 'held_escrow' || booking.disputeStatus === 'open') {
    return NextResponse.json(
      { errors: { state: 'Lesson cannot be completed in this state' } },
      { status: 409 },
    );
  }

  const result = await payoutBooking(booking.id, {
    completedByRole,
    completedByLabel,
  });

  if (result.kind === 'skipped' || result.kind === 'error') {
    return NextResponse.json(
      {
        errors: {
          state:
            result.kind === 'skipped'
              ? `Payout unavailable (${result.reason}). Lesson not marked completed.`
              : 'Payout failed. Lesson not marked completed.',
        },
      },
      { status: 409 },
    );
  }

  const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
  const completedAt = fresh?.completedAt ?? new Date();
  const payoutReleasedAt = fresh?.payoutReleasedAt ?? completedAt;

  after(async () => {
    try {
      await notifyCounterparty({
        booking,
        completedByRole,
        completedByLabel,
        locale: booking.locale === 'en' ? 'en' : 'sv',
      });
    } catch {
      // Non-fatal — payout already succeeded.
    }
  });

  return NextResponse.json(
    BookingCompleteResponse.parse({
      id: booking.id,
      paymentStatus: 'released',
      completedAt: completedAt.toISOString(),
      payoutReleasedAt: payoutReleasedAt.toISOString(),
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
