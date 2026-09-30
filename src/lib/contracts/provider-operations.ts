import { z } from 'zod';
import { AvailabilitySlotItem, ProviderRoleEnum } from '@/lib/contracts/availability';
import {
  BookingPaymentStatusEnum,
  CancellationOutcomeEnum,
  DisputeStatusEnum,
} from '@/lib/contracts/bookings';

export const ProviderBookingItem = z.object({
  id: z.string(),
  counterpartyName: z.string(),
  category: z.string(),
  slotId: z.string().nullable(),
  scheduledAt: z.string().datetime(),
  preferredAt: z.string(),
  durationMinutes: z.number().int().positive(),
  paymentStatus: BookingPaymentStatusEnum,
  providerRole: ProviderRoleEnum,
  locale: z.enum(['sv', 'en']),
  paymentStatusDetail: z.string().nullable(),
  cancellationOutcome: CancellationOutcomeEnum.nullable(),
  cancelledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  deliveredAt: z.string().nullable().optional(),
  autoReleaseAt: z.string().nullable().optional(),
  disputeStatus: DisputeStatusEnum.nullable(),
  priceAmountSek: z.number().int().nonnegative().nullable(),
  serviceFeeSek: z.number().int().nonnegative().nullable(),
  grossChargedSek: z.number().int().nonnegative().nullable(),
  payoutAmountSek: z.number().int().nonnegative().nullable(),
  commissionSek: z.number().int().nonnegative().nullable(),
  netPayoutSek: z.number().int().nonnegative().nullable(),
  receiptAvailable: z.boolean(),
  receiptAmountSek: z.number().int().nonnegative().nullable(),
  receiptStatus: z.string().nullable(),
  receiptEmailStatus: z.string().nullable(),
  capabilities: z.object({
    canAccept: z.boolean(),
    canDecline: z.boolean(),
    canCancel: z.boolean(),
    canComplete: z.boolean(),
    canConfirm: z.boolean().optional(),
    canDisputeEscrow: z.boolean().optional(),
    nextStates: z.array(BookingPaymentStatusEnum),
  }),
});
export type ProviderBookingItem = z.infer<typeof ProviderBookingItem>;

export const ProviderProfile = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  providerRole: ProviderRoleEnum,
  timezone: z.string(),
  setupComplete: z.boolean(),
  bookingMode: z.enum(['instant', 'request']),
  cancellationPolicyTier: z.enum(['flexible', 'moderate', 'strict']),
});
export type ProviderProfile = z.infer<typeof ProviderProfile>;

export const ProviderOperationsResponse = z.object({
  provider: ProviderProfile.nullable(),
  availability: z.array(AvailabilitySlotItem),
  bookings: z.array(ProviderBookingItem),
});
export type ProviderOperationsResponse = z.infer<typeof ProviderOperationsResponse>;

export const ProviderBookingList = z.object({ items: z.array(ProviderBookingItem) });
export type ProviderBookingList = z.infer<typeof ProviderBookingList>;

export const ProviderActionResponse = z.object({
  id: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
  actionUrl: z.string().nullable().optional(),
  cancellationOutcome: CancellationOutcomeEnum.nullable().optional(),
  completedAt: z.string().nullable().optional(),
  payoutReleasedAt: z.string().nullable().optional(),
  deliveredAt: z.string().nullable().optional(),
  autoReleaseAt: z.string().nullable().optional(),
  confirmedAt: z.string().nullable().optional(),
});
export type ProviderActionResponse = z.infer<typeof ProviderActionResponse>;
