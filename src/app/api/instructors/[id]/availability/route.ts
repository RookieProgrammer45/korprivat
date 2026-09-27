//
// `GET /api/instructors/[id]/availability` is called by the learner-side
// booking form island. Only future, unbooked slots are returned; anything
// in the past or already taken (slot.bookedAt !== null) is filtered out
// because that's the contract for "what the learner can pick right now".
//
// The Instructor row's `email` is server-side PII and never projected here
// — same posture as `GET /api/instructors/[id]` (see
// `PUBLIC_INSTRUCTOR_SELECT` in src/lib/contracts/instructors.ts).
import 'server-only';
import { NextResponse } from 'next/server';
import { providerTimezoneForCity } from '@/lib/business/provider-timezone';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: { providerRole: true, city: true },
  });
  if (!instructor)
    return NextResponse.json({ errors: { id: 'Provider not found' } }, { status: 404 });
  const rows = await prisma.availabilitySlot.findMany({
    where: {
      instructorId: id,
      bookedAt: null,
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      instructorId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      bookedAt: true,
    },
  });

  return NextResponse.json(
    AvailabilitySlotList.parse({
      items: rows.map((row) => ({
        id: row.id,
        instructorId: row.instructorId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        durationMinutes: row.durationMinutes,
        bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
        providerRole: instructor.providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR',
        timezone: providerTimezoneForCity(instructor.city),
      })),
    }),
  );
}
