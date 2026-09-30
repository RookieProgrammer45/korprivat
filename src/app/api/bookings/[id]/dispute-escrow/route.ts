// POST /api/bookings/[id]/dispute-escrow — buyer disputes before release.

import 'server-only';
import { after, NextResponse } from 'next/server';
import { resolveBookingActor } from '@/lib/business/booking-actor';
import {
  BookingDisputeEscrowRequest,
  BookingDisputeEscrowResponse,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { OWNER_EMAIL } from '@/lib/ownership';

export const dynamic = 'force-dynamic';

function opsRecipient(): string {
  return (
    process.env.EMAIL_OVERRIDE_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.OWNER_EMAIL?.trim() ||
    OWNER_EMAIL
  );
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingDisputeEscrowRequest.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { userId: true, email: true, name: true },
  });

  const actor = await resolveBookingActor({
    req,
    booking,
    instructorUserId: instructor?.userId,
    bodyToken: parsed.data.token,
  });
  if (!actor) {
    return NextResponse.json({ errors: { access: 'Forbidden' } }, { status: 403 });
  }
  if (actor.role !== 'learner') {
    return NextResponse.json(
      { errors: { access: 'Only the buyer can open an escrow dispute' } },
      { status: 403 },
    );
  }

  if (booking.paymentStatus === 'disputed' && booking.disputeOpenedAt) {
    return NextResponse.json(
      BookingDisputeEscrowResponse.parse({
        id: booking.id,
        paymentStatus: 'disputed',
        disputeOpenedAt: booking.disputeOpenedAt.toISOString(),
      }),
      { status: 200 },
    );
  }

  if (booking.paymentStatus !== 'awaiting_buyer_confirmation') {
    return NextResponse.json(
      {
        errors: {
          state:
            'Escrow dispute is only available while awaiting buyer confirmation. After release, contact support.',
        },
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: 'awaiting_buyer_confirmation' },
    data: {
      disputeOpenedAt: now,
      paymentStatus: 'disputed',
      disputeStatus: 'open',
    },
  });

  if (claimed.count === 0) {
    return NextResponse.json(
      { errors: { state: 'Dispute state changed — refresh and try again' } },
      { status: 409 },
    );
  }

  const reason = parsed.data.reason;
  const details = parsed.data.details?.trim() || '(none)';

  after(async () => {
    try {
      const opsMail = notificationEmail({
        subject: `[DriveLinkUp] Buyer disputed a delivered lesson`,
        title: 'Escrow dispute opened',
        lines: [
          `Buyer disputed a delivered lesson. Booking: ${booking.id}.`,
          `Reason: ${reason}`,
          `Details: ${details}`,
          'Do NOT release funds until resolved via admin resolve-dispute.',
        ],
      });
      await sendEmail({ to: opsRecipient(), ...opsMail });
    } catch (err) {
      console.error('[dispute-escrow] ops email failed', err);
    }

    try {
      if (instructor?.email) {
        const locale = booking.locale === 'en' ? 'en' : 'sv';
        const mail = notificationEmail({
          subject:
            locale === 'en'
              ? 'Learner opened a dispute — DriveLinkUp'
              : 'Eleven har öppnat en tvist — DriveLinkUp',
          title: locale === 'en' ? 'Payout paused' : 'Utbetalning pausad',
          lines:
            locale === 'en'
              ? [
                  `Hi ${instructor.name},`,
                  'The learner opened a dispute about the lesson. Payout is paused until it is resolved.',
                ]
              : [
                  `Hej ${instructor.name},`,
                  'Eleven har öppnat en tvist om lektionen. Utbetalning pausad tills den är löst.',
                ],
        });
        await sendEmail({ to: instructor.email, ...mail });
      }
    } catch (err) {
      console.error('[dispute-escrow] seller email failed', err);
    }
  });

  return NextResponse.json(
    BookingDisputeEscrowResponse.parse({
      id: booking.id,
      paymentStatus: 'disputed',
      disputeOpenedAt: now.toISOString(),
    }),
    { status: 200 },
  );
}
