-- Scheduling context: Booking lesson window + exclusion constraint.
-- Prisma DateTime maps to TIMESTAMP (without time zone) → use tsrange, not tstzrange.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3);

-- Backfill from preferredAt + booked slot duration (default 60 minutes).
UPDATE "Booking" b
SET
  "startsAt" = COALESCE(b."startsAt", b."preferredAt"),
  "endsAt" = COALESCE(
    b."endsAt",
    b."preferredAt" + make_interval(mins => COALESCE(s."durationMinutes", 60))
  )
FROM "AvailabilitySlot" s
WHERE s."bookedBookingId" = b."id"
  AND (b."startsAt" IS NULL OR b."endsAt" IS NULL);

UPDATE "Booking"
SET
  "startsAt" = COALESCE("startsAt", "preferredAt"),
  "endsAt" = COALESCE("endsAt", "preferredAt" + interval '60 minutes')
WHERE "startsAt" IS NULL OR "endsAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Booking_instructorId_startsAt_endsAt_idx"
  ON "Booking"("instructorId", "startsAt", "endsAt");

-- Exclude overlapping active bookings per instructor.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_no_overlap_per_instructor'
  ) THEN
    ALTER TABLE "Booking"
      ADD CONSTRAINT booking_no_overlap_per_instructor
      EXCLUDE USING gist (
        "instructorId" WITH =,
        tsrange("startsAt", "endsAt", '[)') WITH &&
      )
      WHERE (
        "startsAt" IS NOT NULL
        AND "endsAt" IS NOT NULL
        AND ("paymentStatus" IS NULL OR "paymentStatus" NOT IN (
          'cancelled_early',
          'cancelled_late',
          'cancelled_full_refund',
          'cancelled_partial',
          'declined',
          'refunded'
        ))
      );
  END IF;
END $$;
