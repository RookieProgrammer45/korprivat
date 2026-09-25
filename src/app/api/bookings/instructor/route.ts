// @polsia:user-owned — GET /api/bookings/instructor?state=requested
//
// Bookings that the signed-in instructor should action (new request or any
// state filter). Owner-scoped via requireAuth(); resolves the caller's
// Instructor row by its scalar userId link.
//
// The `state=requested` query filter maps to the explicit awaiting_approval
// status. Terminal states remain distinct in the response.

import 'server-only';
import { NextResponse } from 'next/server';
import { bookingCapabilities } from '@/lib/business/booking-transitions';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  providerOwnershipErrorResponse,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import {
  isReceiptPaymentStatus,
  normalizeReceiptEmailDeliveryStatus,
} from '@/lib/business/receipts';
import { BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { ProviderBookingList } from '@/lib/contracts/provider-operations';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const STATE_MAP: Record<string, string[] | undefined> = {
  requested: ['awaiting_approval'],
  awaiting: ['awaiting_approval'],
  pending: ['pending'],
  held: ['held_escrow'],
  released: ['released'],
  refunded: ['refunded'],
  declined: ['declined'],
  cancelled: ['cancelled_early', 'cancelled_late', 'cancelled_full_refund', 'cancelled_partial'],
  all: undefined,
};

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const stateKey = (url.searchParams.get('state') ?? 'requested').toLowerCase();
  const paymentStatuses = STATE_MAP[stateKey];
  if (stateKey !== 'all' && stateKey !== 'completed' && !paymentStatuses) {
    return NextResponse.json({ errors: { state: 'Unknown booking state' } }, { status: 400 });
  }

  // Find the Instructor row owned by this user id. A signed-in user without
  // a matching Instructor row gets an empty list — they signed up but
  // haven't completed instructor onboarding yet.
  let instructor: OwnedProvider | null;
  try {
    instructor = await resolveOwnedProvider(
      user,
      stateKey === 'completed' ? ['INSTRUCTOR'] : undefined,
    );
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      const ownership = providerOwnershipErrorResponse(error);
      return NextResponse.json(
        { errors: { access: ownership?.message ?? 'Provider ownership needs operator review.' } },
        { status: ownership?.status ?? 409 },
      );
    }
    throw error;
  }
  if (!instructor) {
    return NextResponse.json(ProviderBookingList.parse({ items: [] }));
  }

  const rows = await prisma.booking.findMany({
    where: {
      instructorId: instructor.id,
      ...(stateKey === 'completed'
        ? {
            completedAt: { not: null },
            paymentStatus: 'released',
            cancelledAt: null,
            cancellationOutcome: null,
          }
        : paymentStatuses
          ? { paymentStatus: { in: paymentStatuses } }
          : {}),
    },
    orderBy: { preferredAt: stateKey === 'all' ? 'desc' : 'asc' },
    take: 50,
    select: {
      id: true,
      studentName: true,
      category: true,
      preferredAt: true,
      paymentStatus: true,
      priceAmountSek: true,
      serviceFeeSek: true,
      payoutAmountSek: true,
      slotId: true,
      cancellationOutcome: true,
      cancelledAt: true,
      completedAt: true,
      disputeStatus: true,
      grossChargedSek: true,
      locale: true,
    },
  });
  const slots = rows.length
    ? await prisma.availabilitySlot.findMany({
        where: { id: { in: rows.flatMap((row) => (row.slotId ? [row.slotId] : [])) } },
        select: { id: true, startsAt: true, durationMinutes: true },
      })
    : [];
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const receiptRows = rows.length
    ? await prisma.bookingReceipt.findMany({
        where: { bookingId: { in: rows.map((row) => row.id) }, recipientRole: 'instructor' },
        select: {
          bookingId: true,
          priceAmountSek: true,
          serviceFeeSek: true,
          grossChargedSek: true,
          commissionSek: true,
          payoutStatus: true,
          netPayoutSek: true,
          emailDeliveryStatus: true,
        },
      })
    : [];
  const receiptByBooking = new Map(receiptRows.map((row) => [row.bookingId, row]));

  const items = rows.map((b) => {
    const slot = b.slotId ? slotById.get(b.slotId) : undefined;
    const receipt = receiptByBooking.get(b.id);
    const receiptPriceAmountSek = receipt?.priceAmountSek ?? b.priceAmountSek;
    const commissionSek =
      receipt?.commissionSek ??
      (receiptPriceAmountSek != null && b.payoutAmountSek != null
        ? Math.max(0, receiptPriceAmountSek - b.payoutAmountSek)
        : null);
    const paymentStatus = BookingPaymentStatusEnum.safeParse(b.paymentStatus ?? 'unpaid').success
      ? (b.paymentStatus ?? 'unpaid')
      : 'unpaid';
    const capabilities = bookingCapabilities(paymentStatus, 'provider', instructor.providerRole);
    return {
      id: b.id,
      counterpartyName: b.studentName,
      category: b.category,
      slotId: b.slotId ?? null,
      scheduledAt: (slot?.startsAt ?? b.preferredAt).toISOString(),
      preferredAt: b.preferredAt.toISOString(),
      durationMinutes: slot?.durationMinutes ?? 60,
      paymentStatus,
      providerRole: instructor.providerRole,
      locale: b.locale === 'en' ? 'en' : 'sv',
      paymentStatusDetail: null,
      cancellationOutcome: b.cancellationOutcome ?? null,
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
      completedAt: b.completedAt?.toISOString() ?? null,
      disputeStatus:
        b.disputeStatus === 'open' ||
        b.disputeStatus === 'resolved_released' ||
        b.disputeStatus === 'resolved_refunded'
          ? b.disputeStatus
          : null,
      priceAmountSek: receiptPriceAmountSek ?? null,
      serviceFeeSek: receipt?.serviceFeeSek ?? b.serviceFeeSek ?? null,
      grossChargedSek: receipt?.grossChargedSek ?? b.grossChargedSek ?? null,
      payoutAmountSek: b.payoutAmountSek ?? null,
      commissionSek,
      netPayoutSek: receipt?.netPayoutSek ?? b.payoutAmountSek ?? null,
      receiptAvailable: Boolean(receipt) && isReceiptPaymentStatus(b.paymentStatus),
      receiptAmountSek:
        receipt?.netPayoutSek ?? (b.paymentStatus === 'released' ? b.payoutAmountSek : null),
      receiptStatus: receipt?.payoutStatus ?? payoutStatusForPayment(b.paymentStatus),
      receiptEmailStatus: normalizeReceiptEmailDeliveryStatus(receipt?.emailDeliveryStatus),
      capabilities,
    };
  });

  return NextResponse.json(ProviderBookingList.parse({ items }));
}

function payoutStatusForPayment(
  paymentStatus: string | null,
): 'pending' | 'released' | 'refunded' | 'cancelled' | null {
  if (paymentStatus === 'released') return 'released';
  if (paymentStatus === 'refunded') return 'refunded';
  if (paymentStatus?.startsWith('cancelled_')) return 'cancelled';
  if (paymentStatus === 'paid' || paymentStatus === 'held_escrow') return 'pending';
  return null;
}
