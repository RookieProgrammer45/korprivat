//
// Public quote endpoint for any island that needs to render an inline
// per-booking breakdown (price, fee, total) without a
// stored Booking row — e.g. the instructor detail page before the learner
// has sent a request.
//
// Prices are SERVER-ONLY integers. The client passes only an instructor id;
// the published rate is loaded here so the browser cannot alter the quote.

import 'server-only';
import { NextResponse } from 'next/server';
import { learnerTotalSek } from '@/lib/business/booking-fees';
import { BookingFeeQuote, BookingFeeQuoteRequest } from '@/lib/contracts/booking-fees';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = BookingFeeQuoteRequest.safeParse({
    instructorId: url.searchParams.get('instructorId') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { instructorId: 'instructorId query parameter is required' } },
      { status: 400 },
    );
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: parsed.data.instructorId },
    select: { hourlyRateSek: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { instructorId: 'Instructor not found' } }, { status: 404 });
  }

  const totals = learnerTotalSek(instructor.hourlyRateSek);
  return NextResponse.json(
    BookingFeeQuote.parse({
      priceAmountSek: totals.priceSek,
      serviceFeeSek: totals.serviceFeeSek,
      grossChargedSek: totals.totalSek,
    }),
  );
}
