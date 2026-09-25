// @polsia:user-owned — `GET /api/profile/me`.
//
// Owner-scoped readout the dashboard islands need for the rebook card row
// and the saved-payment-method strip:
//
//   - `savedMethods` — `SavedPaymentMethodItem[]` rows for the signed-in
//     learner, sorted most-recent first. Populating this happens in the
//     `payment-poll` route's helper (see `src/lib/business/rebooking-cache.ts`)
//     — this endpoint just reads.
//
//   - `lastInstructors` — up to 4 distinct `instructorId`s the learner
//     has booked, each decorated with the snapshot fields the rebook
//     deep-link needs (instructor name, city, category, hourly rate
//     snapshot from the booking moment, original preferredAt, and the
//     last `Booking.id`). The instructor name + city + hourlyRateSek
//     are joined in via a separate `prisma.instructor.findMany` rather
//     than an `include: { instructor: true }` (skips a reverse-relation
//     re-write if Booking's FK setup changes later).
//
// Why a NEW surface (and not extending `/api/bookings/me`): the brief
// scopes this surface to "saved payment method" + "instructor manifest
// for rebooking". Extending the existing `/api/bookings/me` would pull
// `upcoming-bookings` semantics into the same envelope — the Student
// Dashboard island reads from `/api/bookings/me` and `/api/bookings/
// me/history` already, so a separate `/api/profile/me` keeps the
// new readout from leaking into that contract.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  type ProfileLastBookedInstructor,
  ProfileMeReadout,
  type SavedPaymentMethodItem,
} from '@/lib/contracts/saved-payment-methods';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const MAX_LAST_INSTRUCTORS = 4;

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  const userId = user.id;

  const [savedMethods, bookings] = await Promise.all([
    loadSavedMethods(userId),
    loadLastInstructorBookings(userId),
  ]);

  // Distinct-by-instructor, ordered by the user's most-recent booking.
  // `instructorId` is the persistence key — the (entity) row a learner
  // rebooks against — so collapsing on it removes dup-candidates without
  // needing a "lastBookingId per user" join.
  const distinct: ProfileLastBookedInstructor[] = [];
  const seenInstructors = new Set<string>();
  // Pull the instructor name + city + base rate for every distinct id in
  // a single follow-up query — avoiding `include: { instructor: true }`
  // so the response shape is stable through the FK refactor.
  const instructorIds: string[] = [];
  for (const b of bookings) {
    if (seenInstructors.has(b.instructorId)) continue;
    seenInstructors.add(b.instructorId);
    instructorIds.push(b.instructorId);
    if (instructorIds.length >= MAX_LAST_INSTRUCTORS) break;
  }
  const instructors = instructorIds.length
    ? await prisma.instructor.findMany({
        where: { id: { in: instructorIds } },
        select: { id: true, name: true, city: true, hourlyRateSek: true },
      })
    : [];
  const instructorById = new Map(instructors.map((i) => [i.id, i]));

  for (const id of instructorIds) {
    const row = bookings.find((b) => b.instructorId === id);
    const inst = instructorById.get(id);
    if (!row || !inst) continue;
    distinct.push({
      id,
      name: inst.name,
      city: inst.city,
      category: row.category,
      hourlyRateSek: inst.hourlyRateSek,
      preferredAt: row.preferredAt.toISOString(),
      lastBookingId: row.id,
    });
  }

  return NextResponse.json(
    ProfileMeReadout.parse({
      savedMethods: { items: savedMethods },
      lastInstructors: distinct,
    }),
  );
}

async function loadSavedMethods(userId: string): Promise<SavedPaymentMethodItem[]> {
  const rows = await prisma.savedPaymentMethod.findMany({
    where: { userId },
    orderBy: [{ lastUsedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      customerEmail: true,
      brand: true,
      last4: true,
      lastUsedAt: true,
      // `isDefault` is server-set; we cannot infer it from a query against
      // a `@default(false)` boolean, so we re-derive the "most-recent"
      // default sticker from the index. The first row IS the default iff
      // every row is currently `isDefault: false` (because we reset on
      // upsert). In practice this means: a learner who has never set a
      // default sees their most-recent-stripe-charge as the implicit default.
    },
  });

  if (rows.length === 0) return [];

  return rows.map((r, i) => ({
    id: r.id,
    customerEmail: r.customerEmail,
    brand: r.brand,
    last4: r.last4 ?? null,
    lastUsedAt: r.lastUsedAt.toISOString(),
    isDefault: i === 0,
  }));
}

async function loadLastInstructorBookings(userId: string) {
  // Pull every booking — including the cancelled / refunded ones — but only
  // those owned by this user (Booking.userId is the scalar FK the rebook
  // POST sets). `orderBy: createdAt desc` so disticting by `instructorId`
  // gives the user's most-recent contact per instructor.
  return prisma.booking.findMany({
    where: {
      userId,
      // Don't include `cancelled_late` / `cancelled_early` from the rebook
      // picker — a learner who cancelled a prior booking doesn't want it
      // re-suggested as a rebook target. `held_escrow` / `released` /
      // `pending` / `unpaid` are all valid.
      paymentStatus: {
        notIn: ['cancelled_early', 'cancelled_late', 'refunded'],
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      instructorId: true,
      category: true,
      preferredAt: true,
    },
    take: MAX_LAST_INSTRUCTORS * 6,
  });
}
