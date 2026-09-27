//
// Read-only history of every booking (past + upcoming) that the signed-in
// learner owns. Used by the dashboard island's "See all bookings" deep-link
// (`/dashboard/student/bookings`). Owner-scoped via requireAuth() — a 401
// without the cookie — and the WHERE clause is the scalar userId link.
//
// Two queries — booking rows + a single follow-up `instructor.findMany` for
// `id`/`name`/`city`/`hourlyRateSek`. We skip `include: { instructor: true }`
// on purpose so a future FK tweak can't silently widen this response shape.
// The hourlyRateSek is the LIVE rate, not a snapshot — matching the
// trade-off the rest of the booking handlers already accept (and surfaced
// as `priceApproxNote` on the client). Status-badge logic and the past/
// upcoming split live on the client island, not here.
//
// Stable order: `preferredAt desc` so the most recent lesson is first.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  isReceiptPaymentStatus,
  normalizeReceiptEmailDeliveryStatus,
} from '@/lib/business/receipts';
import { BookingHistoryList } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { preferredAt: 'desc' },
    take: 200,
    select: {
      id: true,
      instructorId: true,
      category: true,
      preferredAt: true,
      slotId: true,
      paymentStatus: true,
      cancellationOutcome: true,
      cancelledAt: true,
      completedAt: true,
      disputeStatus: true,
      // Per-booking fee snapshots — optional, all nullable so pre-
      // FeeModel rows parse cleanly. Surfaced so the history list can
      // show what each row actually charged.
      priceAmountSek: true,
      serviceFeeSek: true,
      grossChargedSek: true,
    },
  });

  // One second query for the instructor id → name/city/rate map. Avoids
  // `include: { instructor: true }` so a future FK refactor can't silently
  // widen the response shape.
  const ids = Array.from(new Set(rows.map((r) => r.instructorId)));
  const instructors = ids.length
    ? await prisma.instructor.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, city: true, hourlyRateSek: true, providerRole: true },
      })
    : [];
  const infoByInstructor = new Map(instructors.map((i) => [i.id, i]));
  const slotIds = rows.flatMap((row) => (row.slotId ? [row.slotId] : []));
  const slots = slotIds.length
    ? await prisma.availabilitySlot.findMany({
        where: { id: { in: slotIds } },
        select: { id: true, startsAt: true, durationMinutes: true },
      })
    : [];
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const receiptRows = rows.length
    ? await prisma.bookingReceipt.findMany({
        where: { bookingId: { in: rows.map((row) => row.id) }, recipientRole: 'learner' },
        select: { bookingId: true, emailDeliveryStatus: true },
      })
    : [];
  const receiptByBooking = new Map(receiptRows.map((row) => [row.bookingId, row]));

  const items = rows.map((b) => {
    const info = infoByInstructor.get(b.instructorId);
    return {
      id: b.id,
      instructorId: b.instructorId,
      instructorName: info?.name ?? 'Unknown instructor',
      city: info?.city ?? '',
      category: b.category,
      preferredAt: b.preferredAt.toISOString(),
      scheduledAt: (slotById.get(b.slotId ?? '')?.startsAt ?? b.preferredAt).toISOString(),
      slotId: b.slotId,
      durationMinutes: slotById.get(b.slotId ?? '')?.durationMinutes ?? 60,
      providerRole: info?.providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR',
      hourlyRateSek: info?.hourlyRateSek ?? 0,
      paymentStatus: b.paymentStatus ?? 'unpaid',
      cancellationOutcome: b.cancellationOutcome ?? null,
      cancelledAt: isoOrNull(b.cancelledAt),
      completedAt: isoOrNull(b.completedAt),
      disputeStatus: b.disputeStatus ?? null,
      priceAmountSek: b.priceAmountSek ?? null,
      serviceFeeSek: b.serviceFeeSek ?? null,
      grossChargedSek: b.grossChargedSek ?? null,
      receiptAvailable: receiptByBooking.has(b.id) && isReceiptPaymentStatus(b.paymentStatus),
      receiptEmailStatus: normalizeReceiptEmailDeliveryStatus(
        receiptByBooking.get(b.id)?.emailDeliveryStatus,
      ),
    };
  });

  return NextResponse.json(BookingHistoryList.parse({ items }));
}
