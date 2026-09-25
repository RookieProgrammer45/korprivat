// @polsia:user-owned — POST /api/bookings/[id]/dispute
//
// "Open a dispute" terminal transition for the escrow flow. Either the
// learner or the instructor can flag a problem — both carry the same
// per-booking unguessable action token in the deep-link. The transaction
// creates a Dispute row and writes `disputeStatus: 'open'` on the booking
// atomically; a second-arriving open call sees zero affected rows and the
// route returns 409 with the existing dispute state.
//
// Side effect: notify the *other* party that a dispute was opened.
import 'server-only';
import { NextResponse } from 'next/server';
import { assertTokenMatches } from '@/lib/business/escrow';
import { BookingDisputeOpenRequest, BookingDisputeResponse } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { disputeOpenedEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

const REASON_SNIPPET_MAX = 140;

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingDisputeOpenRequest.safeParse(bodyJson);
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
  if (booking.disputeStatus === 'open') {
    return NextResponse.json(
      { errors: { state: 'A dispute is already open on this booking' } },
      { status: 409 },
    );
  }
  if (booking.paymentStatus !== 'held_escrow') {
    return NextResponse.json(
      { errors: { state: 'Disputes can only be opened before payout release' } },
      { status: 409 },
    );
  }

  const openedByAt = new Date();
  const [, bookingUpdate] = await prisma.$transaction([
    prisma.dispute.create({
      data: {
        bookingId: booking.id,
        openedByRole: data.openedByRole,
        openedByLabel: data.openedByLabel,
        openedByAt,
        reason: data.reason,
        status: 'open',
      },
    }),
    prisma.booking.updateMany({
      where: { id: booking.id, disputeStatus: null },
      data: { disputeStatus: 'open' },
    }),
  ]);
  // `updateMany` is non-throwing on count=0 — so the precondition above is
  // not a true race guard. Two near-simultaneous dispute POSTs can both
  // reach this line; the second sees count=0 because the first already
  // flipped disputeStatus. Treat that as idempotent but DO NOT notify again:
  // the dispute is already open, the second caller learns via the 409.
  if (bookingUpdate.count === 0) {
    return NextResponse.json(
      { errors: { state: 'A dispute is already open on this booking' } },
      { status: 409 },
    );
  }

  await notifyCounterparty({
    booking,
    openedByRole: data.openedByRole,
    openedByLabel: data.openedByLabel,
    reasonSnippet: truncate(data.reason, REASON_SNIPPET_MAX),
  }).catch((_reason) => {});

  return NextResponse.json(
    BookingDisputeResponse.parse({ id: booking.id, disputeStatus: 'open' }),
    { status: 201 },
  );
}

async function notifyCounterparty(input: {
  booking: { id: string; studentName: string; studentEmail: string; instructorId: string };
  openedByRole: 'learner' | 'instructor';
  openedByLabel: string;
  reasonSnippet: string;
}) {
  const otherRole: 'learner' | 'instructor' =
    input.openedByRole === 'learner' ? 'instructor' : 'learner';
  const instructor = await prisma.instructor.findUnique({
    where: { id: input.booking.instructorId },
    select: { email: true, name: true },
  });
  const recipientEmail =
    otherRole === 'learner' ? input.booking.studentEmail : (instructor?.email ?? null);
  if (!recipientEmail) return;
  const mail = disputeOpenedEmail({
    recipientRole: otherRole,
    openerLabel: input.openedByLabel,
    reasonSnippet: input.reasonSnippet,
    bookingId: input.booking.id,
  });
  await sendEmail({ to: recipientEmail, ...mail });
}
