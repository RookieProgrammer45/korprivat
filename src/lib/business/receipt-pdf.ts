// @polsia:user-owned — canonical receipt authorization and PDF document mapping.
import 'server-only';
import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import { isReceiptPaymentStatus, type ReceiptRole } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import type { DocumentSpec } from '@/lib/pdf/schema';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export type CanonicalReceiptRow = {
  receiptNumber: string;
  bookingId: string;
  recipientRole: ReceiptRole;
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
  emailDeliveryStatus: string | null;
};

export type AuthorizedReceiptResult =
  | { kind: 'booking_not_found' }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden' }
  | { kind: 'unavailable' }
  | { kind: 'receipt_not_found' }
  | { kind: 'authorized'; recipientRole: ReceiptRole; receipt: CanonicalReceiptRow };

const RECEIPT_SELECT = {
  receiptNumber: true,
  bookingId: true,
  recipientRole: true,
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
  paymentStatus: true,
  payoutStatus: true,
  emailDeliveryStatus: true,
  issuedAt: true,
} as const;

export async function getAuthorizedBookingReceipt(
  req: Request,
  bookingId: string,
): Promise<AuthorizedReceiptResult> {
  const suppliedToken = getBookingAccessToken(req);
  let sessionUser: SessionUser | null = null;
  try {
    sessionUser = await requireAuth(req);
  } catch {
    if (!suppliedToken) return { kind: 'unauthenticated' };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      userId: true,
      instructorId: true,
      paymentStatus: true,
      learnerAccessTokenHash: true,
      actionToken: true,
    },
  });
  if (!booking) return { kind: 'booking_not_found' };

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { userId: true },
  });
  const sessionRole: ReceiptRole | null =
    sessionUser?.id === booking.userId
      ? 'learner'
      : sessionUser?.id === instructor?.userId
        ? 'instructor'
        : null;
  const tokenRole: ReceiptRole | null = matchesLearnerAccessToken(
    booking.learnerAccessTokenHash,
    suppliedToken,
  )
    ? 'learner'
    : suppliedToken && assertTokenMatches(booking.actionToken, suppliedToken)
      ? 'instructor'
      : null;
  const recipientRole = sessionRole ?? tokenRole;

  if (!recipientRole) {
    return { kind: sessionUser || suppliedToken ? 'forbidden' : 'unauthenticated' };
  }
  if (!isReceiptPaymentStatus(booking.paymentStatus)) return { kind: 'unavailable' };

  const receipt = await prisma.bookingReceipt.findUnique({
    where: { bookingId_recipientRole: { bookingId, recipientRole } },
    select: RECEIPT_SELECT,
  });
  if (!receipt) return { kind: 'receipt_not_found' };
  if (receipt.recipientRole !== recipientRole) return { kind: 'receipt_not_found' };

  return { kind: 'authorized', recipientRole, receipt: { ...receipt, recipientRole } };
}

const PDF_COPY = {
  en: {
    title: 'DriveLinkUp booking receipt',
    receiptNumber: 'Receipt number',
    date: 'Date and time',
    lesson: 'Lesson price (SEK)',
    serviceFee: 'DriveLinkUp fee (SEK)',
    grossPaid: 'Learner-paid gross total (SEK)',
    commission: '10% school commission (SEK)',
    reconciliation: 'Net payout = school price − attributable school commission after completion.',
    note: (usd: string) => `Verified checkout charge: ${usd}. Amounts are shown in SEK.`,
  },
  sv: {
    title: 'DriveLinkUp bokningskvitto',
    receiptNumber: 'Kvittonummer',
    date: 'Datum och tid',
    lesson: 'Lektionspris (SEK)',
    serviceFee: 'DriveLinkUp-avgift (SEK)',
    grossPaid: 'Elevens brutto betalda belopp (SEK)',
    commission: '10% skolprovision (SEK)',
    reconciliation:
      'Nettoutbetalning = skolans pris − hänförlig skolprovision efter genomförd tjänst.',
    note: (usd: string) => `Verifierad kassabetalning: ${usd}. Beloppen visas i SEK.`,
  },
} as const;

export function buildReceiptPdfSpec(receipt: CanonicalReceiptRow): DocumentSpec {
  const locale = receipt.locale === 'en' ? 'en' : 'sv';
  const copy = PDF_COPY[locale];
  const formattedDate = new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(receipt.scheduledAt);
  const formattedUsd = new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(receipt.verifiedAmountUsd);
  const lineItems =
    receipt.recipientRole === 'learner'
      ? [
          {
            description: copy.lesson,
            quantity: 1,
            unitAmountCents: receipt.priceAmountSek * 100,
          },
          ...(receipt.serviceFeeSek > 0
            ? [
                {
                  description: copy.serviceFee,
                  quantity: 1,
                  unitAmountCents: receipt.serviceFeeSek * 100,
                },
              ]
            : []),
        ]
      : [
          {
            description: copy.grossPaid,
            quantity: 1,
            unitAmountCents: receipt.grossChargedSek * 100,
          },
          ...(receipt.serviceFeeSek > 0
            ? [
                {
                  description: copy.serviceFee,
                  quantity: 1,
                  unitAmountCents: -receipt.serviceFeeSek * 100,
                },
              ]
            : []),
          {
            description: copy.commission,
            quantity: 1,
            unitAmountCents: -receipt.commissionSek * 100,
          },
        ];

  return {
    title: copy.title,
    subtitle: `${receipt.instructorName} · ${receipt.category}`,
    meta: [
      { label: copy.receiptNumber, value: receipt.receiptNumber },
      { label: copy.date, value: formattedDate },
    ],
    lineItems,
    totalCents:
      (receipt.recipientRole === 'learner' ? receipt.grossChargedSek : receipt.netPayoutSek) * 100,
    notes:
      receipt.recipientRole === 'instructor'
        ? `${copy.note(formattedUsd)} ${copy.reconciliation}`
        : copy.note(formattedUsd),
    footer: 'DriveLinkUp',
  };
}

export function receiptPdfFileName(receiptNumber: string): string {
  const safeReceiptNumber = receiptNumber.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${safeReceiptNumber || 'receipt'}.pdf`;
}
