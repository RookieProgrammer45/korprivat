//
// Helper that both the booking-create and payment-poll routes call so the
// `RebookingCache` row mirrors the latest booking-context per (userId,
// instructorId) pair. The cache is the data the rebook form on
// `/instructors/[id]?rebook=<bookingId>` reads to pre-fill.
//
// The function is FAILURE-INSENSITIVE on purpose: a `prisma` write that
// throws must not surface a 5xx to the user — the booking is already
// persisted and the rebook cache is purely a UX shortcut (the rebook
// form also accepts fresh data typed in by hand). The route callers
// await this inside their existing `try / catch` and let any errors hit
// the existing `catch (... ignore)` path.
//
// Two call sites:
//
//   1. `POST /api/bookings` — fires when the learner creates a brand-new
//      booking. The `Booking.userId` is now stamped (the API fills it
//      from the session) so the cache writer can carry it forward.
//
//   2. `POST /api/bookings/[id]/payment-poll` — fires ONCE, after
//      `held_escrow`, and only on the fulfilling update (the `count === 1`
//      branch). The cache update is `upsert` keyed on
//      `(userId, instructorId)` so:

import 'server-only';
import { prisma } from '@/lib/db';

interface RebookCacheInput {
  userId: string;
  instructorId: string;
  category: string;
  studentName: string;
  studentPhone: string;
  // Booking.id the rebook deep-link should carry. Optional because the
  // create site may not have it yet (it does — `Booking.id` is the
  // return of `prisma.booking.create`) but kept nullable so the helper
  // can be called from a partial path that doesn't know the id yet.
  lastBookingId: string;
}

export async function recordRebookingContext(input: RebookCacheInput): Promise<void> {
  try {
    await prisma.rebookingCache.upsert({
      where: {
        userId_instructorId: {
          userId: input.userId,
          instructorId: input.instructorId,
        },
      },
      create: {
        userId: input.userId,
        instructorId: input.instructorId,
        category: input.category,
        studentName: input.studentName,
        studentPhone: input.studentPhone,
        lastBookingId: input.lastBookingId,
      },
      update: {
        category: input.category,
        studentName: input.studentName,
        studentPhone: input.studentPhone,
        lastBookingId: input.lastBookingId,
      },
    });
  } catch {
    // Failure-insensitive: see header. The booking row is already on
    // disk and the cache is a UX-only convenience.
  }
}
