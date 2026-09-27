// surface. Powers the instructor-detail breakdown card and the instructor
// dashboard payout card. Both ends read from `/api/booking-fees/*` so the
// constants never live in the client.

import { z } from 'zod';

/**
 * Response for authenticated provider accounts calling
 * `GET /api/booking-fees/config`. The commission value is intentionally kept
 * out of the public learner quote contract.
 */
export const InstructorFeesConfig = z.object({
  serviceFeePercent: z.number().int().nonnegative(),
  commissionPercent: z.number().int().positive(),
});
export type InstructorFeesConfig = z.infer<typeof InstructorFeesConfig>;

/**
 * Response for `GET /api/booking-fees/quote?instructorId=…`. Returns the
 * learner-facing breakdown for a hypothetical booking at the instructor's
 * published hourly rate. All values are non-negative integer SEK.
 */
export const BookingFeeQuote = z.object({
  priceAmountSek: z.number().int().nonnegative(),
  serviceFeeSek: z.number().int().nonnegative(),
  grossChargedSek: z.number().int().nonnegative(),
});
export type BookingFeeQuote = z.infer<typeof BookingFeeQuote>;

export const BookingFeeQuoteRequest = z.object({
  instructorId: z.string().min(1),
});
export type BookingFeeQuoteRequest = z.infer<typeof BookingFeeQuoteRequest>;
