// POST /api/bookings/[id]/confirm — buyer confirms delivery → release_ready → payout.

import 'server-only';
import { after, NextResponse } from 'next/server';
import { resolveBookingActor } from '@/lib/business/booking-actor';
import {
  BookingConfirmRequest,
  BookingConfirmResponse,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { payoutBooking } from '@/lib/payments/payouts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) bodyJson = JSON.parse(text);
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingConfirmRequest.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ errors: { form: 'Invalid body' } }, { status: 400 });
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
      { errors: { access: 'Only the buyer can confirm delivery' } },
      { status: 403 },
    );
  }

  const terminalReady = new Set(['release_ready', 'released', 'payout_pending', 'payout_failed']);
  if (booking.paymentStatus && terminalReady.has(booking.paymentStatus)) {
    return NextResponse.json(
      BookingConfirmResponse.parse({
        id: booking.id,
        paymentStatus: booking.paymentStatus as
          | 'release_ready'
          | 'released'
          | 'payout_pending'
          | 'payout_failed',
        confirmedAt: booking.confirmedAt?.toISOString() ?? null,
      }),
      { status: 200 },
    );
  }

  if (booking.paymentStatus !== 'awaiting_buyer_confirmation') {
    return NextResponse.json(
      { errors: { state: 'Booking is not awaiting buyer confirmation' } },
      { status: 409 },
    );
  }

  const now = new Date();
  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: 'awaiting_buyer_confirmation' },
    data: {
      confirmedAt: now,
      paymentStatus: 'release_ready',
    },
  });

  if (claimed.count === 0) {
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (fresh?.paymentStatus && terminalReady.has(fresh.paymentStatus)) {
      return NextResponse.json(
        BookingConfirmResponse.parse({
          id: fresh.id,
          paymentStatus: fresh.paymentStatus as
            | 'release_ready'
            | 'released'
            | 'payout_pending'
            | 'payout_failed',
          confirmedAt: fresh.confirmedAt?.toISOString() ?? null,
        }),
        { status: 200 },
      );
    }
    return NextResponse.json(
      { errors: { state: 'Confirmation state changed — refresh and try again' } },
      { status: 409 },
    );
  }

  after(async () => {
    try {
      await payoutBooking(booking.id, {
        completedByRole: 'learner',
        completedByLabel: parsed.data.confirmedByLabel ?? booking.studentName,
      });
    } catch (err) {
      console.error('[confirm] payoutBooking failed', err);
    }

    try {
      const locale = booking.locale === 'en' ? 'en' : 'sv';
      if (instructor?.email) {
        const mail = notificationEmail({
          subject:
            locale === 'en'
              ? 'Learner confirmed — payout starting — DriveLinkUp'
              : 'Eleven har bekräftat — utbetalning startar — DriveLinkUp',
          title: locale === 'en' ? 'Payout starting' : 'Utbetalning startar',
          lines:
            locale === 'en'
              ? [
                  `Hi ${instructor.name},`,
                  'The learner confirmed the lesson. Payout starts within 2–3 banking days.',
                ]
              : [
                  `Hej ${instructor.name},`,
                  'Eleven har bekräftat lektionen. Utbetalning startar inom 2-3 bankdagar.',
                ],
        });
        await sendEmail({ to: instructor.email, ...mail });
      }
    } catch (err) {
      console.error('[confirm] seller email failed', err);
    }
  });

  return NextResponse.json(
    BookingConfirmResponse.parse({
      id: booking.id,
      paymentStatus: 'release_ready',
      confirmedAt: now.toISOString(),
    }),
    { status: 200 },
  );
}
