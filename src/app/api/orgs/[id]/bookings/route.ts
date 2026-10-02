//
// GET /api/orgs/[id]/bookings — ACTIVE OWNER|STAFF list of bookings stamped
// with this organizationId. Read-only for Phase 2b (mutations stay instructor).

import 'server-only';
import { NextResponse } from 'next/server';
import { bookingCapabilities } from '@/lib/business/booking-transitions';
import {
  isReceiptPaymentStatus,
  normalizeReceiptEmailDeliveryStatus,
} from '@/lib/business/receipts';
import { BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { SchoolBookingList } from '@/lib/contracts/provider-operations';
import { prisma } from '@/lib/db';
import {
  assertActiveMember,
  getOrganizationById,
  OrgForbiddenError,
  OrgNotFoundError,
} from '@/lib/orgs/service';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: Request, context: RouteContext) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const { id: orgId } = await context.params;

  try {
    const org = await getOrganizationById(orgId);
    if (!org) throw new OrgNotFoundError();
    await assertActiveMember(orgId, user.id);
  } catch (err) {
    if (err instanceof OrgForbiddenError) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (err instanceof OrgNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    throw err;
  }

  const url = new URL(req.url);
  const stateKey = (url.searchParams.get('state') ?? 'all').toLowerCase();

  const rows = await prisma.booking.findMany({
    where: {
      organizationId: orgId,
      ...(stateKey === 'requested'
        ? { paymentStatus: 'awaiting_approval' }
        : stateKey === 'upcoming'
          ? {
              cancellationOutcome: null,
              paymentStatus: {
                notIn: [
                  'declined',
                  'refunded',
                  'cancelled_early',
                  'cancelled_late',
                  'cancelled_full_refund',
                  'cancelled_partial',
                  'released',
                ],
              },
              preferredAt: { gte: new Date() },
            }
          : {}),
    },
    orderBy: { preferredAt: 'desc' },
    take: 50,
    select: {
      id: true,
      instructorId: true,
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
      deliveredAt: true,
      autoReleaseAt: true,
      disputeStatus: true,
      grossChargedSek: true,
      locale: true,
    },
  });

  const instructorIds = [...new Set(rows.map((r) => r.instructorId))];
  const instructors = instructorIds.length
    ? await prisma.instructor.findMany({
        where: { id: { in: instructorIds } },
        select: { id: true, name: true, providerRole: true },
      })
    : [];
  const instructorById = new Map(instructors.map((i) => [i.id, i]));

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
    const instructor = instructorById.get(b.instructorId);
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
    // School staff: read-only — zero action capabilities.
    const capabilities = bookingCapabilities(paymentStatus, null, null);
    const providerRole =
      instructor?.providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR';
    return {
      id: b.id,
      instructorId: b.instructorId,
      instructorName: instructor?.name ?? '—',
      counterpartyName: b.studentName,
      category: b.category,
      slotId: b.slotId ?? null,
      scheduledAt: (slot?.startsAt ?? b.preferredAt).toISOString(),
      preferredAt: b.preferredAt.toISOString(),
      durationMinutes: slot?.durationMinutes ?? 60,
      paymentStatus,
      providerRole,
      locale: b.locale === 'en' ? 'en' : 'sv',
      paymentStatusDetail: null,
      cancellationOutcome: b.cancellationOutcome ?? null,
      cancelledAt: b.cancelledAt?.toISOString() ?? null,
      completedAt: b.completedAt?.toISOString() ?? null,
      deliveredAt: b.deliveredAt?.toISOString() ?? null,
      autoReleaseAt: b.autoReleaseAt?.toISOString() ?? null,
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
      receiptStatus: receipt?.payoutStatus ?? null,
      receiptEmailStatus: normalizeReceiptEmailDeliveryStatus(receipt?.emailDeliveryStatus),
      capabilities,
    };
  });

  return NextResponse.json(SchoolBookingList.parse({ items }));
}
