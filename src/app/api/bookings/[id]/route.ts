import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { bookingCapabilities } from '@/lib/business/booking-transitions';
import { getPolicyForTier, isCancellationTier } from '@/lib/business/cancellation-policy';
import { assertTokenMatches } from '@/lib/business/escrow';
import { isLicenceCategoryCode } from '@/lib/business/licence-categories';
import { normalizeReceiptEmailDeliveryStatus } from '@/lib/business/receipts';
import {
  type BookingPaymentStatus,
  BookingPaymentStatusEnum,
  BookingRead,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const PAYMENT_STATUSES = BookingPaymentStatusEnum.options;

function isoOrNull(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function safePaymentStatus(value: string | null | undefined): BookingPaymentStatus {
  return PAYMENT_STATUSES.includes(value as BookingPaymentStatus)
    ? (value as BookingPaymentStatus)
    : 'unpaid';
}

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { name: true, city: true, hourlyRateSek: true, userId: true, providerRole: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }

  const sessionUser = await getSessionUser();
  const suppliedToken = getBookingAccessToken(req);
  const learnerTokenAuthorized = matchesLearnerAccessToken(
    booking.learnerAccessTokenHash,
    suppliedToken,
  );
  const instructorTokenAuthorized =
    suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken);
  const learnerSessionAuthorized =
    sessionUser != null &&
    (booking.userId === sessionUser.id ||
      booking.studentEmail.trim().toLowerCase() === sessionUser.email.trim().toLowerCase());
  const providerSessionAuthorized = sessionUser != null && instructor.userId === sessionUser.id;
  const sessionAuthorized = learnerSessionAuthorized || providerSessionAuthorized;
  const tokenAuthorized = learnerTokenAuthorized || instructorTokenAuthorized;
  const actor =
    learnerSessionAuthorized || learnerTokenAuthorized
      ? ('learner' as const)
      : providerSessionAuthorized || instructorTokenAuthorized
        ? ('provider' as const)
        : null;
  const receiptRole = actor === 'learner' ? 'learner' : actor === 'provider' ? 'instructor' : null;
  if (!sessionAuthorized && !tokenAuthorized) {
    return NextResponse.json(
      { errors: { access: 'Booking access is invalid or expired' } },
      { status: 403 },
    );
  }

  const receipt = receiptRole
    ? await prisma.bookingReceipt.findUnique({
        where: { bookingId_recipientRole: { bookingId: booking.id, recipientRole: receiptRole } },
        select: { emailDeliveryStatus: true },
      })
    : null;
  const slot = booking.slotId
    ? await prisma.availabilitySlot.findUnique({
        where: { id: booking.slotId },
        select: { startsAt: true, durationMinutes: true },
      })
    : null;
  const scheduledAt = slot?.startsAt ?? booking.preferredAt;
  const durationMinutes = slot?.durationMinutes ?? 60;
  const tier = isCancellationTier(booking.cancellationPolicyTier)
    ? booking.cancellationPolicyTier
    : null;
  const terms = tier ? getPolicyForTier(tier) : null;
  const category = isLicenceCategoryCode(booking.category) ? booking.category : 'B';
  const providerRole = instructor.providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR';
  const capabilities = bookingCapabilities(
    safePaymentStatus(booking.paymentStatus),
    actor,
    actor === 'provider' ? providerRole : null,
  );

  const body = {
    id: booking.id,
    instructorId: booking.instructorId,
    providerName: instructor.name,
    providerCity: instructor.city,
    category,
    slotId: booking.slotId ?? null,
    durationMinutes,
    scheduledAt: scheduledAt.toISOString(),
    preferredAt: booking.preferredAt.toISOString(),
    paymentStatus: safePaymentStatus(booking.paymentStatus),
    hourlyRateSek: booking.priceAmountSek ?? instructor.hourlyRateSek,
    heldAt: isoOrNull(booking.heldAt),
    completedAt: isoOrNull(booking.completedAt),
    disputeStatus: booking.disputeStatus ?? null,
    cancellationOutcome: booking.cancellationOutcome ?? null,
    cancelledAt: isoOrNull(booking.cancelledAt),
    cancelledByRole:
      booking.cancelledByRole === 'learner' || booking.cancelledByRole === 'instructor'
        ? booking.cancelledByRole
        : null,
    cancellationPolicyTier: tier,
    cancellationTerms: terms,
    bookingMode: booking.bookingMode === 'request' ? 'request' : 'instant',
    locale: booking.locale === 'en' ? 'en' : 'sv',
    priceAmountSek: booking.priceAmountSek ?? null,
    serviceFeeSek: booking.serviceFeeSek ?? null,
    grossChargedSek: booking.grossChargedSek ?? null,
    receiptEmailStatus: normalizeReceiptEmailDeliveryStatus(receipt?.emailDeliveryStatus),
    providerRole,
    capabilities,
  };

  return NextResponse.json(BookingRead.parse(body), { status: 200 });
}
