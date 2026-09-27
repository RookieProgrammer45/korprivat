//
// Bookings that the signed-in student owns through the scalar Booking.userId
// link. Owner-scoped via requireAuth() so the route cannot be hit anonymously.
//
// Returns a thin "at-a-glance" list shape used by the dashboard island — not
// the full BookingRead contract, since the dashboard does not need the
// escrow detail. Click-through on a row lands on /bookings/[id] for the full
// view. Ownership is Booking.userId === session user.id.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  isReceiptPaymentStatus,
  normalizeReceiptEmailDeliveryStatus,
} from '@/lib/business/receipts';
import { BookingList } from '@/lib/contracts/auth';
import { BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const rows = await prisma.booking.findMany({
    where: { userId: user.id },
    orderBy: { preferredAt: 'asc' },
    take: 50,
    select: {
      id: true,
      instructorId: true,
      category: true,
      preferredAt: true,
      slotId: true,
      paymentStatus: true,
      grossChargedSek: true,
    },
  });

  // One join-free lookup of instructor names for the result set.
  const ids = Array.from(new Set(rows.map((r) => r.instructorId)));
  const instructors = ids.length
    ? await prisma.instructor.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, providerRole: true },
      })
    : [];
  const nameByInstructor = new Map(instructors.map((i) => [i.id, i.name]));
  const roleByInstructor = new Map(instructors.map((i) => [i.id, i.providerRole]));
  const slotIds = rows.flatMap((row) => (row.slotId ? [row.slotId] : []));
  const slots = slotIds.length
    ? await prisma.availabilitySlot.findMany({
        where: { id: { in: slotIds } },
        select: { id: true, startsAt: true, endsAt: true, durationMinutes: true },
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
    const slot = slotById.get(b.slotId ?? '');
    const durationMinutes = slot
      ? (slot.durationMinutes ??
        Math.max(1, Math.round((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000)))
      : 60;
    return {
      id: b.id,
      counterpartyName: nameByInstructor.get(b.instructorId) ?? 'Awaiting confirmation',
      category: b.category,
      preferredAt: b.preferredAt.toISOString(),
      scheduledAt: (slot?.startsAt ?? b.preferredAt).toISOString(),
      slotId: b.slotId,
      durationMinutes,
      providerRole:
        roleByInstructor.get(b.instructorId) === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR',
      paymentStatus: BookingPaymentStatusEnum.safeParse(b.paymentStatus ?? 'unpaid').success
        ? (b.paymentStatus ?? 'unpaid')
        : 'unpaid',
      receiptAvailable: receiptByBooking.has(b.id) && isReceiptPaymentStatus(b.paymentStatus),
      receiptAmountSek: b.grossChargedSek ?? null,
      receiptStatus: null,
      receiptEmailStatus: normalizeReceiptEmailDeliveryStatus(
        receiptByBooking.get(b.id)?.emailDeliveryStatus,
      ),
    };
  });

  return NextResponse.json(BookingList.parse({ items }));
}
