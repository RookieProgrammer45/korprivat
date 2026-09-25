// @polsia:user-owned — canonical receipt email delivery and retry service.
import 'server-only';
import { generateLearnerAccessToken } from '@/lib/business/booking-access';
import { registerKnownContact } from '@/lib/business/escrow';
import { normalizeReceiptEmailDeliveryStatus, type ReceiptRole } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { bookingReceiptEmail } from '@/lib/email/templates';
import { resolveOrigin } from '@/lib/payments/origin';

const STALE_SEND_MS = 10 * 60 * 1000;

type DeliveryStatus = 'pending' | 'sending' | 'sent' | 'failed' | null;

type ReceiptDeliveryRow = {
  id: string;
  receiptNumber: string;
  bookingId: string;
  recipientRole: string;
  locale: string;
  learnerName: string;
  instructorName: string;
  category: string;
  scheduledAt: Date;
  priceAmountSek: number;
  serviceFeeSek: number;
  grossChargedSek: number;
  commissionSek: number;
  netPayoutSek: number;
  emailDeliveryStatus: string | null;
};

type DeliveryBooking = {
  id: string;
  studentName: string;
  studentEmail: string;
  instructorId: string;
  actionToken: string | null;
  learnerAccessTokenHash: string | null;
  instructor: { email: string | null; name: string } | null;
};

export type ReceiptDeliveryResult = {
  status: DeliveryStatus;
  attempted: boolean;
  failureReason?: string;
};

const RECEIPT_SELECT = {
  id: true,
  receiptNumber: true,
  bookingId: true,
  recipientRole: true,
  locale: true,
  learnerName: true,
  instructorName: true,
  category: true,
  scheduledAt: true,
  priceAmountSek: true,
  serviceFeeSek: true,
  grossChargedSek: true,
  commissionSek: true,
  netPayoutSek: true,
  emailDeliveryStatus: true,
} as const;

export async function getReceiptEmailDeliveryStatus(
  bookingId: string,
  recipientRole: ReceiptRole,
): Promise<DeliveryStatus> {
  const row = await prisma.bookingReceipt.findUnique({
    where: { bookingId_recipientRole: { bookingId, recipientRole } },
    select: { emailDeliveryStatus: true },
  });
  return normalizeReceiptEmailDeliveryStatus(row?.emailDeliveryStatus);
}

export async function deliverBookingReceipt(input: {
  bookingId: string;
  recipientRole: ReceiptRole;
  req: Request;
  learnerAccessToken?: string;
  booking?: DeliveryBooking;
}): Promise<ReceiptDeliveryResult> {
  const booking =
    input.booking ??
    ((await prisma.booking.findUnique({
      where: { id: input.bookingId },
      select: {
        id: true,
        studentName: true,
        studentEmail: true,
        instructorId: true,
        actionToken: true,
        learnerAccessTokenHash: true,
        instructor: { select: { email: true, name: true } },
      },
    })) as DeliveryBooking | null);
  if (!booking) return failedResult('Booking not found');

  const receipt = (await prisma.bookingReceipt.findUnique({
    where: {
      bookingId_recipientRole: {
        bookingId: input.bookingId,
        recipientRole: input.recipientRole,
      },
    },
    select: RECEIPT_SELECT,
  })) as ReceiptDeliveryRow | null;
  if (!receipt) return failedResult('Receipt not found');

  const recipientEmail =
    input.recipientRole === 'learner' ? booking.studentEmail : booking.instructor?.email;
  if (!recipientEmail) return failedResult('Recipient email is unavailable');

  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_SEND_MS);
  const claim = await prisma.bookingReceipt.updateMany({
    where: {
      id: receipt.id,
      OR: [
        { emailDeliveryStatus: { in: ['pending', 'failed'] } },
        { emailDeliveryStatus: 'sending', emailLastAttemptAt: null },
        { emailDeliveryStatus: 'sending', emailLastAttemptAt: { lt: staleBefore } },
      ],
    },
    data: {
      emailDeliveryStatus: 'sending',
      emailLastAttemptAt: now,
      emailFailureReason: null,
    },
  });
  if (claim.count === 0) {
    return {
      status: normalizeReceiptEmailDeliveryStatus(receipt.emailDeliveryStatus),
      attempted: false,
    };
  }

  try {
    let learnerAccessToken = input.learnerAccessToken;
    if (input.recipientRole === 'learner' && !learnerAccessToken) {
      const generated = generateLearnerAccessToken();
      await prisma.booking.update({
        where: { id: booking.id },
        data: { learnerAccessTokenHash: generated.tokenHash },
      });
      learnerAccessToken = generated.token;
    }

    const origin = resolveOrigin(input.req);
    const actionToken = booking.actionToken;
    const receiptToken =
      input.recipientRole === 'learner' ? learnerAccessToken : (actionToken ?? undefined);
    const receiptUrl = `${origin}/bookings/${booking.id}/receipt${receiptToken ? `?token=${encodeURIComponent(receiptToken)}` : ''}`;
    const actionUrls = actionToken
      ? {
          completeUrl: `${origin}/bookings/${booking.id}/complete?token=${encodeURIComponent(actionToken)}`,
          disputeUrl: `${origin}/bookings/${booking.id}/dispute?token=${encodeURIComponent(actionToken)}`,
        }
      : {};
    const mail = bookingReceiptEmail({
      locale: receipt.locale === 'en' ? 'en' : 'sv',
      recipientRole: input.recipientRole,
      recipientName:
        input.recipientRole === 'learner'
          ? receipt.learnerName
          : (booking.instructor?.name ?? receipt.instructorName),
      instructorName: receipt.instructorName,
      category: receipt.category,
      lessonDate: receipt.scheduledAt.toISOString(),
      receiptUrl,
      ...actionUrls,
      bookingId: receipt.bookingId,
      priceAmountSek: receipt.priceAmountSek,
      serviceFeeSek: receipt.serviceFeeSek,
      grossChargedSek: receipt.grossChargedSek,
      commissionSek: receipt.commissionSek,
      netPayoutSek: receipt.netPayoutSek,
    });

    if (input.recipientRole === 'learner') {
      await registerKnownContact({
        email: recipientEmail,
        name: receipt.learnerName,
        source: 'purchase',
      });
    }

    const result = await sendEmail({ to: recipientEmail, ...mail });
    const providerId = result && typeof result.id === 'string' ? result.id.trim() : '';
    if (!providerId) return await markFailed(receipt.id, 'Email provider returned no message id');
    await prisma.bookingReceipt.updateMany({
      where: { id: receipt.id, emailDeliveryStatus: 'sending' },
      data: {
        emailDeliveryStatus: 'sent',
        emailSentAt: new Date(),
        emailFailureReason: null,
      },
    });
    return { status: 'sent', attempted: true };
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : 'Email delivery failed';
    return await markFailed(receipt.id, reason.slice(0, 1000));
  }
}

async function markFailed(id: string, reason: string): Promise<ReceiptDeliveryResult> {
  await prisma.bookingReceipt.updateMany({
    where: { id, emailDeliveryStatus: 'sending' },
    data: { emailDeliveryStatus: 'failed', emailFailureReason: reason },
  });
  return { status: 'failed', attempted: true, failureReason: reason };
}

function failedResult(reason: string): ReceiptDeliveryResult {
  return { status: 'failed', attempted: false, failureReason: reason };
}
