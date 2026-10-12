//
// Public quote endpoint for any island that needs to render an inline
// per-booking breakdown (price, fee, total) without a
// stored Booking row — e.g. the instructor detail page before the learner
// has sent a request.
//
// Prices are SERVER-ONLY integers. The client passes an instructor and slot id;
// the rate and duration are loaded here so the browser cannot alter the quote.

import 'server-only';
import { NextResponse } from 'next/server';
import { learnerTotalSek, lessonPriceForDurationSek } from '@/lib/business/booking-fees';
import { isPublicBookableProvider } from '@/lib/business/provider-activation';
import { BookingFeeQuote, BookingFeeQuoteRequest } from '@/lib/contracts/booking-fees';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = BookingFeeQuoteRequest.safeParse({
    instructorId: url.searchParams.get('instructorId') ?? undefined,
    slotId: url.searchParams.get('slotId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { slotId: 'instructorId and slotId query parameters are required' } },
      { status: 400 },
    );
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: parsed.data.instructorId },
    select: { hourlyRateSek: true, userId: true, categories: true, providerRole: true },
  });
  if (!instructor || !(await isPublicBookableProvider(instructor))) {
    return NextResponse.json({ errors: { instructorId: 'Instructor not found' } }, { status: 404 });
  }

  const slot = await prisma.availabilitySlot.findFirst({
    where: {
      id: parsed.data.slotId,
      instructorId: parsed.data.instructorId,
      bookedAt: null,
      startsAt: { gt: new Date() },
    },
    select: { durationMinutes: true },
  });
  if (!slot) {
    return NextResponse.json({ errors: { slotId: 'Slot no longer available' } }, { status: 404 });
  }

  const totals = learnerTotalSek(
    lessonPriceForDurationSek(instructor.hourlyRateSek, slot.durationMinutes),
  );
  return NextResponse.json(
    BookingFeeQuote.parse({
      priceAmountSek: totals.priceSek,
      serviceFeeSek: totals.serviceFeeSek,
      grossChargedSek: totals.totalSek,
    }),
  );
}
