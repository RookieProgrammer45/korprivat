import 'server-only';
import { instructorPayoutSek, learnerTotalSek } from '@/lib/business/booking-fees';
import {
  type Receipt,
  type ReceiptEmailDeliveryStatus,
  ReceiptEmailDeliveryStatusEnum,
} from '@/lib/contracts/receipts';
import { prisma } from '@/lib/db';

export type ReceiptRole = 'learner' | 'instructor';

export function normalizeReceiptEmailDeliveryStatus(
  status: string | null | undefined,
): ReceiptEmailDeliveryStatus | null {
  const parsed = ReceiptEmailDeliveryStatusEnum.safeParse(status);
  return parsed.success ? parsed.data : null;
}

export const RECEIPT_PAYMENT_STATUSES = [
  'paid',
  'held_escrow',
  'released',
  'refunded',
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
] as const;

export function isReceiptPaymentStatus(status: string | null | undefined) {
  return RECEIPT_PAYMENT_STATUSES.includes(status as (typeof RECEIPT_PAYMENT_STATUSES)[number]);
}

type BookingSnapshot = {
  id: string;
  userId: string | null;
  studentName: string;
  instructorId: string;
  category: string;
  preferredAt: Date;
  paymentStatus: string | null;
  priceAmountSek: number | null;
  serviceFeeSek: number | null;
  grossChargedSek: number | null;
  payoutAmountSek: number | null;
  organizationId?: string | null;
  locale?: string | null;
  slot?: { startsAt: Date; durationMinutes: number } | null;
};

type PaidBookingSnapshot = BookingSnapshot & {
  heldAt?: Date | null;
  payoutReleasedAt?: Date | null;
};

type InstructorSnapshot = {
  name: string;
  city: string;
  hourlyRateSek: number;
  userId?: string | null;
};

function safeLocale(locale: string | null | undefined): 'sv' | 'en' {
  return locale === 'en' ? 'en' : 'sv';
}

function safeMoney(value: number | null | undefined, fallback: number): number {
  return Math.max(0, Math.round(value ?? fallback));
}

function paymentStatusForReceipt(status: string | null | undefined): string {
  return status ?? 'unpaid';
}

function payoutStatusForReceipt(
  status: string | null | undefined,
): 'pending' | 'released' | 'refunded' | 'cancelled' {
  if (status === 'released') return 'released';
  if (status === 'refunded') return 'refunded';
  if (status?.startsWith('cancelled_')) return 'cancelled';
  return 'pending';
}

function receiptNumber(bookingId: string, role: ReceiptRole): string {
  return `DLU-${bookingId}-${role === 'learner' ? 'L' : 'I'}`.toUpperCase();
}

export function receiptAmounts(
  booking: Pick<
    BookingSnapshot,
    'priceAmountSek' | 'serviceFeeSek' | 'grossChargedSek' | 'organizationId'
  >,
  rateSek: number,
) {
  const totals = learnerTotalSek(safeMoney(booking.priceAmountSek, rateSek));
  const priceAmountSek = safeMoney(booking.priceAmountSek, totals.priceSek);
  const serviceFeeSek = safeMoney(booking.serviceFeeSek, totals.serviceFeeSek);
  const grossChargedSek = safeMoney(booking.grossChargedSek, priceAmountSek + serviceFeeSek);
  const payout = instructorPayoutSek(priceAmountSek, {
    organizationId: booking.organizationId,
  });
  return {
    priceAmountSek,
    serviceFeeSek,
    grossChargedSek,
    commissionSek: payout.commissionSek,
    netPayoutSek: payout.payoutSek,
  };
}

export async function ensureBookingReceipts(input: {
  booking: BookingSnapshot;
  instructor: InstructorSnapshot;
  verifiedAmountUsd: number;
  locale?: string | null;
}) {
  const amounts = receiptAmounts(input.booking, input.instructor.hourlyRateSek);
  const scheduledAt = input.booking.slot?.startsAt ?? input.booking.preferredAt;
  const durationMinutes = input.booking.slot?.durationMinutes ?? 60;
  const locale = safeLocale(input.locale ?? input.booking.locale);
  const paymentStatus = paymentStatusForReceipt(input.booking.paymentStatus);
  const payoutStatus = payoutStatusForReceipt(input.booking.paymentStatus);
  const common = {
    bookingId: input.booking.id,
    locale,
    learnerName: input.booking.studentName,
    instructorName: input.instructor.name,
    instructorCity: input.instructor.city,
    category: input.booking.category,
    scheduledAt,
    durationMinutes,
    priceAmountSek: amounts.priceAmountSek,
    serviceFeeSek: amounts.serviceFeeSek,
    grossChargedSek: amounts.grossChargedSek,
    commissionSek: amounts.commissionSek,
    netPayoutSek: amounts.netPayoutSek,
    verifiedAmountUsd: Math.max(0, Math.round(input.verifiedAmountUsd)),
    paymentStatus,
  };

  await Promise.all([
    prisma.bookingReceipt.upsert({
      where: {
        bookingId_recipientRole: {
          bookingId: input.booking.id,
          recipientRole: 'learner',
        },
      },
      create: {
        ...common,
        recipientUserId: input.booking.userId,
        recipientRole: 'learner',
        receiptNumber: receiptNumber(input.booking.id, 'learner'),
        payoutStatus: 'not_applicable',
        emailDeliveryStatus: 'pending',
      },
      update: { paymentStatus, verifiedAmountUsd: common.verifiedAmountUsd },
    }),
    prisma.bookingReceipt.upsert({
      where: {
        bookingId_recipientRole: {
          bookingId: input.booking.id,
          recipientRole: 'instructor',
        },
      },
      create: {
        ...common,
        recipientUserId: input.instructor.userId ?? null,
        recipientRole: 'instructor',
        receiptNumber: receiptNumber(input.booking.id, 'instructor'),
        payoutStatus,
        emailDeliveryStatus: 'pending',
      },
      update: {
        paymentStatus,
        payoutStatus,
        verifiedAmountUsd: common.verifiedAmountUsd,
      },
    }),
  ]);
}

export async function syncBookingReceiptStatuses(
  bookingId: string,
  paymentStatus: string,
  payoutStatus?: string,
) {
  await Promise.all([
    prisma.bookingReceipt.updateMany({
      where: { bookingId, recipientRole: 'learner' },
      data: { paymentStatus, payoutStatus: 'not_applicable' },
    }),
    prisma.bookingReceipt.updateMany({
      where: { bookingId, recipientRole: 'instructor' },
      data: { paymentStatus, ...(payoutStatus ? { payoutStatus } : {}) },
    }),
  ]);
}

export async function repairPaidCancellationReceipts(input: {
  booking: PaidBookingSnapshot;
  instructor?: InstructorSnapshot | null;
  paymentStatus: string;
  verifiedAmountUsd: number;
}) {
  const existing = await prisma.bookingReceipt.findMany({
    where: { bookingId: input.booking.id },
    select: {
      recipientRole: true,
      recipientUserId: true,
      locale: true,
      learnerName: true,
      instructorName: true,
      instructorCity: true,
      category: true,
      scheduledAt: true,
      durationMinutes: true,
      priceAmountSek: true,
      serviceFeeSek: true,
      grossChargedSek: true,
      commissionSek: true,
      netPayoutSek: true,
      verifiedAmountUsd: true,
    },
  });
  const hasPersistedPayment =
    existing.length > 0 ||
    input.booking.paymentStatus === 'paid' ||
    input.booking.paymentStatus === 'held_escrow' ||
    input.booking.heldAt != null ||
    input.booking.payoutReleasedAt != null ||
    input.booking.payoutAmountSek != null;

  if (!hasPersistedPayment) return false;

  const existingRoles = new Set(existing.map((row) => row.recipientRole));
  const source = existing[0];
  if (existingRoles.has('learner') && existingRoles.has('instructor')) {
    await syncBookingReceiptStatuses(input.booking.id, input.paymentStatus, 'cancelled');
    return true;
  }

  const instructor =
    input.instructor ??
    (await prisma.instructor.findUnique({
      where: { id: input.booking.instructorId },
      select: { userId: true, name: true, city: true, hourlyRateSek: true },
    }));
  if (!instructor) {
    await syncBookingReceiptStatuses(input.booking.id, input.paymentStatus, 'cancelled');
    return true;
  }

  const amounts = receiptAmounts(input.booking, instructor.hourlyRateSek);
  const common = {
    bookingId: input.booking.id,
    locale: source?.locale ?? safeLocale(input.booking.locale),
    learnerName: source?.learnerName ?? input.booking.studentName,
    instructorName: source?.instructorName ?? instructor.name,
    instructorCity: source?.instructorCity ?? instructor.city,
    category: source?.category ?? input.booking.category,
    scheduledAt: source?.scheduledAt ?? input.booking.slot?.startsAt ?? input.booking.preferredAt,
    durationMinutes: source?.durationMinutes ?? input.booking.slot?.durationMinutes ?? 60,
    priceAmountSek: source?.priceAmountSek ?? amounts.priceAmountSek,
    serviceFeeSek: source?.serviceFeeSek ?? amounts.serviceFeeSek,
    grossChargedSek: source?.grossChargedSek ?? amounts.grossChargedSek,
    commissionSek: source?.commissionSek ?? amounts.commissionSek,
    netPayoutSek: source?.netPayoutSek ?? amounts.netPayoutSek,
    verifiedAmountUsd:
      source?.verifiedAmountUsd ?? Math.max(0, Math.round(input.verifiedAmountUsd)),
    paymentStatus: input.paymentStatus,
  };

  await Promise.all([
    prisma.bookingReceipt.upsert({
      where: {
        bookingId_recipientRole: {
          bookingId: input.booking.id,
          recipientRole: 'learner',
        },
      },
      create: {
        ...common,
        recipientUserId: input.booking.userId,
        recipientRole: 'learner',
        receiptNumber: receiptNumber(input.booking.id, 'learner'),
        payoutStatus: 'not_applicable',
        emailDeliveryStatus: 'pending',
      },
      update: { paymentStatus: input.paymentStatus, payoutStatus: 'not_applicable' },
    }),
    prisma.bookingReceipt.upsert({
      where: {
        bookingId_recipientRole: {
          bookingId: input.booking.id,
          recipientRole: 'instructor',
        },
      },
      create: {
        ...common,
        recipientUserId: instructor.userId ?? null,
        recipientRole: 'instructor',
        receiptNumber: receiptNumber(input.booking.id, 'instructor'),
        payoutStatus: 'cancelled',
        emailDeliveryStatus: 'pending',
      },
      update: { paymentStatus: input.paymentStatus, payoutStatus: 'cancelled' },
    }),
  ]);
  return true;
}

export function receiptResponse(row: {
  receiptNumber: string;
  bookingId: string;
  recipientRole: string;
  locale: string;
  learnerName: string;
  instructorName: string;
  instructorCity: string;
  category: string;
  scheduledAt: Date;
  durationMinutes: number;
  priceAmountSek: number;
  serviceFeeSek: number;
  grossChargedSek: number;
  commissionSek: number;
  netPayoutSek: number;
  verifiedAmountUsd: number;
  paymentStatus: string;
  payoutStatus: string;
  issuedAt: Date;
  emailDeliveryStatus?: string | null;
}): Receipt {
  const common = {
    receiptNumber: row.receiptNumber,
    bookingId: row.bookingId,
    locale: safeLocale(row.locale),
    learnerName: row.learnerName,
    instructorName: row.instructorName,
    instructorCity: row.instructorCity,
    category: row.category,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMinutes: row.durationMinutes,
    verifiedAmountUsd: row.verifiedAmountUsd,
    paymentStatus: row.paymentStatus,
    emailDeliveryStatus: normalizeReceiptEmailDeliveryStatus(row.emailDeliveryStatus),
    issuedAt: row.issuedAt.toISOString(),
  };
  if (row.recipientRole === 'learner') {
    return {
      ...common,
      recipientRole: 'learner',
      lessonPriceSek: row.priceAmountSek,
      serviceFeeSek: row.serviceFeeSek,
      totalPaidSek: row.grossChargedSek,
      payoutStatus: 'not_applicable',
    };
  }
  return {
    ...common,
    recipientRole: 'instructor',
    grossLessonPriceSek: row.priceAmountSek,
    grossChargedSek: row.grossChargedSek,
    serviceFeeSek: row.serviceFeeSek,
    commissionSek: row.commissionSek,
    netPayoutSek: row.netPayoutSek,
    payoutStatus: row.payoutStatus as 'pending' | 'released' | 'refunded' | 'cancelled',
  };
}
