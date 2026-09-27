// and `npm run db:seed`. Instructors come from the deterministic manifest;
// open weekday slots make the booking form testable without a live editor.

import type { PrismaClient } from '@prisma/client';
import { seedRows } from '@/lib/business/instructor-seeds';

const SLOT_DURATION_MINUTES = 60;
const WEEKDAYS_AHEAD = 5;
const SLOT_HOURS_UTC = [8, 12] as const;

export type DemoAvailabilitySlot = {
  instructorId: string;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

export function buildDemoAvailabilitySlots(
  instructorIds: readonly string[],
  now = new Date(),
): DemoAvailabilitySlot[] {
  const slots: DemoAvailabilitySlot[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

  let weekdays = 0;
  while (weekdays < WEEKDAYS_AHEAD) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) {
      for (const hour of SLOT_HOURS_UTC) {
        for (const instructorId of instructorIds) {
          const startsAt = new Date(
            Date.UTC(
              cursor.getUTCFullYear(),
              cursor.getUTCMonth(),
              cursor.getUTCDate(),
              hour,
              0,
              0,
            ),
          );
          if (startsAt.getTime() <= now.getTime()) continue;
          slots.push({
            instructorId,
            startsAt,
            endsAt: new Date(startsAt.getTime() + SLOT_DURATION_MINUTES * 60_000),
            durationMinutes: SLOT_DURATION_MINUTES,
          });
        }
      }
      weekdays += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return slots;
}

export async function seedMarketplace(prisma: PrismaClient): Promise<{
  instructors: number;
  slots: number;
}> {
  for (const row of seedRows) {
    const data = {
      name: row.name,
      city: row.city,
      serviceArea: row.serviceArea ?? row.city,
      categories: row.categories,
      hourlyRateSek: row.hourlyRateSek,
      bio: row.bio,
      photoUrl: row.photoUrl,
      bookedHours: row.bookedHours,
      email: row.email,
      englishSpeaking: row.englishSpeaking,
      latitude: row.latitude,
      longitude: row.longitude,
      cancellationPolicyTier: row.cancellationPolicyTier ?? 'flexible',
      bookingMode: row.bookingMode ?? 'instant',
      providerRole: row.providerRole ?? 'INSTRUCTOR',
    };
    await prisma.instructor.upsert({
      where: { id: row.id },
      update: data,
      create: { id: row.id, ...data },
    });
  }

  const slots = buildDemoAvailabilitySlots(seedRows.map((row) => row.id));
  for (const slot of slots) {
    await prisma.availabilitySlot.upsert({
      where: {
        instructorId_startsAt: {
          instructorId: slot.instructorId,
          startsAt: slot.startsAt,
        },
      },
      create: slot,
      update: {},
    });
  }

  return { instructors: seedRows.length, slots: slots.length };
}
