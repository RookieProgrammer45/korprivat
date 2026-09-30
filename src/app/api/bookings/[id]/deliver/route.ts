// POST /api/bookings/[id]/deliver — instructor marks lesson delivered.
// Funds stay in escrow until buyer confirms or 48h auto-release.

import 'server-only';
import { after, NextResponse } from 'next/server';
import { autoReleaseAtFrom, resolveBookingActor } from '@/lib/business/booking-actor';
import {
  BookingDeliverRequest,
  BookingDeliverResponse,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingDeliverRequest.safeParse(bodyJson);
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
    select: { userId: true, name: true },
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
  if (actor.role !== 'instructor') {
    return NextResponse.json(
      { errors: { access: 'Only the instructor can mark a lesson delivered' } },
      { status: 403 },
    );
  }

  // Idempotent: already awaiting confirmation.
  if (
    booking.paymentStatus === 'awaiting_buyer_confirmation' &&
    booking.deliveredAt != null &&
    booking.autoReleaseAt != null
  ) {
    return NextResponse.json(
      BookingDeliverResponse.parse({
        id: booking.id,
        paymentStatus: 'awaiting_buyer_confirmation',
        deliveredAt: booking.deliveredAt.toISOString(),
        autoReleaseAt: booking.autoReleaseAt.toISOString(),
      }),
      { status: 200 },
    );
  }

  if (booking.paymentStatus !== 'held_escrow') {
    return NextResponse.json(
      { errors: { state: 'Lesson can only be marked delivered while held in escrow' } },
      { status: 409 },
    );
  }

  const now = new Date();
  const autoReleaseAt = autoReleaseAtFrom(now);

  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: 'held_escrow' },
    data: {
      deliveredAt: now,
      autoReleaseAt,
      completedByRole: 'instructor',
      completedByLabel: parsed.data.deliveredByLabel,
      paymentStatus: 'awaiting_buyer_confirmation',
    },
  });

  if (claimed.count === 0) {
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    if (
      fresh?.paymentStatus === 'awaiting_buyer_confirmation' &&
      fresh.deliveredAt &&
      fresh.autoReleaseAt
    ) {
      return NextResponse.json(
        BookingDeliverResponse.parse({
          id: fresh.id,
          paymentStatus: 'awaiting_buyer_confirmation',
          deliveredAt: fresh.deliveredAt.toISOString(),
          autoReleaseAt: fresh.autoReleaseAt.toISOString(),
        }),
        { status: 200 },
      );
    }
    return NextResponse.json(
      { errors: { state: 'Delivery state changed — refresh and try again' } },
      { status: 409 },
    );
  }

  after(async () => {
    try {
      const locale = booking.locale === 'en' ? 'en' : 'sv';
      const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.drivelinkup.com').replace(
        /\/+$/,
        '',
      );
      const mail = notificationEmail({
        subject:
          locale === 'en'
            ? 'Confirm your lesson — DriveLinkUp'
            : 'Bekräfta din lektion — DriveLinkUp',
        title: locale === 'en' ? 'Confirm your lesson' : 'Bekräfta din lektion',
        lines:
          locale === 'en'
            ? [
                `Hi ${booking.studentName},`,
                `${instructor?.name ?? 'Your instructor'} marked the lesson as completed.`,
                'Confirm within 48 hours if everything went well. After that we auto-release payment to the instructor.',
              ]
            : [
                `Hej ${booking.studentName},`,
                `Din lektion är markerad som genomförd. Bekräfta inom 48 timmar om allt gick bra.`,
                'Om du inte svarar frigörs betalningen automatiskt till läraren efter 48 timmar.',
              ],
        cta: {
          label: locale === 'en' ? 'Open bookings' : 'Öppna bokningar',
          url: `${appUrl}/dashboard/student/bookings`,
        },
      });
      await sendEmail({ to: booking.studentEmail, ...mail });
    } catch (err) {
      console.error('[deliver] buyer email failed', err);
    }
  });

  return NextResponse.json(
    BookingDeliverResponse.parse({
      id: booking.id,
      paymentStatus: 'awaiting_buyer_confirmation',
      deliveredAt: now.toISOString(),
      autoReleaseAt: autoReleaseAt.toISOString(),
    }),
    { status: 200 },
  );
}
