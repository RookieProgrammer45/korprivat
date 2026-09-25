// @polsia:user-owned — shared receipt wire contracts.
import { z } from 'zod';
import { documentSpecSchema } from '@/lib/pdf/schema';

export const ReceiptEmailDeliveryStatusEnum = z.enum(['pending', 'sending', 'sent', 'failed']);
export type ReceiptEmailDeliveryStatus = z.infer<typeof ReceiptEmailDeliveryStatusEnum>;

const ReceiptBase = z.object({
  receiptNumber: z.string(),
  bookingId: z.string(),
  locale: z.enum(['sv', 'en']),
  learnerName: z.string(),
  instructorName: z.string(),
  instructorCity: z.string(),
  category: z.string(),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  verifiedAmountUsd: z.number().int().nonnegative(),
  paymentStatus: z.string(),
  emailDeliveryStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
  issuedAt: z.string().datetime(),
});

export const LearnerReceipt = ReceiptBase.extend({
  recipientRole: z.literal('learner'),
  lessonPriceSek: z.number().int().nonnegative(),
  serviceFeeSek: z.number().int().nonnegative(),
  totalPaidSek: z.number().int().nonnegative(),
  payoutStatus: z.literal('not_applicable'),
});

export const InstructorReceipt = ReceiptBase.extend({
  recipientRole: z.literal('instructor'),
  grossLessonPriceSek: z.number().int().nonnegative(),
  grossChargedSek: z.number().int().nonnegative(),
  serviceFeeSek: z.number().int().nonnegative(),
  commissionSek: z.number().int().nonnegative(),
  netPayoutSek: z.number().int().nonnegative(),
  payoutStatus: z.enum(['pending', 'released', 'refunded', 'cancelled']),
});

export const Receipt = z.discriminatedUnion('recipientRole', [LearnerReceipt, InstructorReceipt]);
export type LearnerReceipt = z.infer<typeof LearnerReceipt>;
export type InstructorReceipt = z.infer<typeof InstructorReceipt>;
export type Receipt = z.infer<typeof Receipt>;

export const ReceiptAvailability = z.object({
  receiptAvailable: z.boolean(),
  receiptNumber: z.string().nullable(),
});

export const ReceiptResendResponse = z.object({
  emailDeliveryStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
  attempted: z.boolean(),
});

export const ReceiptPdfDocument = documentSpecSchema;
