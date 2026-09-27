//
// Closing transition for the dispute flow. Either party (the one carrying the
// token) can call this with `outcome: 'released'` (terms agreed — funds go
// to the instructor) or `outcome: 'refunded'` (refund the learner; the
// operator settles the Stripe refund out-of-band per the stripe-payments
// skill's note — app code does not issue Stripe refunds).
//
// Race-safely: the booking update has `where: { disputeStatus: 'open' }` so
// the second-arriving resolve call matches zero rows and returns 409.
//
// Side effect: notify the *non*-resolver party that the dispute is closed.
import 'server-only';
import { NextResponse } from 'next/server';
import { instructorPayoutSek } from '@/lib/business/booking-fees';
import { assertTokenMatches } from '@/lib/business/escrow';
import { syncBookingReceiptStatuses } from '@/lib/business/receipts';
import { BookingDisputeResolveRequest, BookingDisputeResponse } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { disputeResolvedEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingDisputeResolveRequest.safeParse(bodyJson);
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
  if (!assertTokenMatches(booking.actionToken, data.token)) {
    return NextResponse.json({ errors: { token: 'Invalid action token' } }, { status: 403 });
  }
  if (booking.disputeStatus !== 'open') {
    return NextResponse.json(
      { errors: { state: 'No open dispute on this booking' } },
      { status: 409 },
    );
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { email: true, name: true, hourlyRateSek: true },
  });

  const now = new Date();
  const resolvedDisputeStatus =
    data.outcome === 'released' ? 'resolved_released' : 'resolved_refunded';

  const bookingData: {
    disputeStatus: string;
    paymentStatus?: string;
    payoutReleasedAt?: Date;
    payoutAmountSek?: number;
    releasedByRole?: string;
    releasedByLabel?: string;
  } = { disputeStatus: resolvedDisputeStatus };

  if (data.outcome === 'released') {
    bookingData.paymentStatus = 'released';
    bookingData.payoutReleasedAt = now;
    bookingData.payoutAmountSek = instructorPayoutSek(
      booking.priceAmountSek ?? instructor?.hourlyRateSek ?? 0,
    ).payoutSek;
    bookingData.releasedByRole = 'instructor';
    bookingData.releasedByLabel = data.resolvedByLabel;
  } else {
    // Refund path: do NOT set payoutReleasedAt (the funds never moved from
    // escrow); flip paymentStatus so the read endpoint reflects "refunded".
    bookingData.paymentStatus = 'refunded';
  }

  const results = await prisma.$transaction([
    prisma.booking.updateMany({
      where: { id: booking.id, disputeStatus: 'open' },
      data: bookingData,
    }),
    prisma.dispute.updateMany({
      where: { bookingId: booking.id, status: 'open' },
      data: {
        status: resolvedDisputeStatus,
        resolvedByLabel: data.resolvedByLabel,
        resolvedByAt: now,
        resolutionNote: data.resolutionNote ?? null,
      },
    }),
  ]);

  // Race guard: the precondition above + the conditional `where:` together
  // are the idempotency boundary. If either update matched zero rows, the
  // booking is already resolved under someone else's call — return 409.
  const bookingUpdate = results[0];
  if (bookingUpdate.count === 0) {
    return NextResponse.json(
      { errors: { state: 'No open dispute on this booking' } },
      { status: 409 },
    );
  }

  await syncBookingReceiptStatuses(
    booking.id,
    data.outcome === 'released' ? 'released' : 'refunded',
    data.outcome === 'released' ? 'released' : 'refunded',
  );

  await notifyCounterparty({
    booking,
    instructor,
    resolvedByLabel: data.resolvedByLabel,
    outcome: data.outcome,
    note: data.resolutionNote ?? null,
  }).catch((_reason) => {});

  return NextResponse.json(
    BookingDisputeResponse.parse({ id: booking.id, disputeStatus: resolvedDisputeStatus }),
    { status: 200 },
  );
}

async function notifyCounterparty(input: {
  booking: { id: string; studentName: string; studentEmail: string; instructorId: string };
  instructor: { email: string | null; name: string } | null;
  resolvedByLabel: string;
  outcome: 'released' | 'refunded';
  note: string | null;
}) {
  const recipientTasks: Array<Promise<void>> = [];
  recipientTasks.push(
    sendEmail({
      to: input.booking.studentEmail,
      ...disputeResolvedEmail({
        recipientRole: 'learner',
        resolvedByLabel: input.resolvedByLabel,
        outcome: input.outcome,
        note: input.note,
        bookingId: input.booking.id,
      }),
    }).then(() => undefined),
  );
  if (input.instructor?.email) {
    recipientTasks.push(
      sendEmail({
        to: input.instructor.email,
        ...disputeResolvedEmail({
          recipientRole: 'instructor',
          resolvedByLabel: input.resolvedByLabel,
          outcome: input.outcome,
          note: input.note,
          bookingId: input.booking.id,
        }),
      }).then(() => undefined),
    );
  }
  await Promise.allSettled(recipientTasks);
}
