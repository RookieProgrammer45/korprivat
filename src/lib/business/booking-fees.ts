// @polsia:user-owned — single source of truth for the per-booking fee model.
//
// DriveLinkUp does not add a learner service fee. A new booking charges only
// the school's published lesson price. The school commission is 10% of the
// attributable booking value and applies only after completed service.
//
// This file is a pure module — NO Prisma, NO fetch, NO env reads. Any server
// route or route handler can import it without dragging in server-only imports
// that would leak into a client island.

import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';

// Named constants. Touching these is intentional and means changing the
// product price — not a refactor. Hard-coding 0.05 / 0.10 outside this
// file is a code-review red flag.
export const LEARNER_SERVICE_FEE_PERCENT = 0;
export const INSTRUCTOR_COMMISSION_PERCENT = 10;

// Internal integer-SEK math so receipts + audit rows match the displayed
// figures exactly. Rounding strategy: half-up at 0.5 (Math.round does that
// for positive inputs).
function percent(amountSek: number, percentValue: number): number {
  return Math.round((amountSek * percentValue) / 100);
}

/**
 * Learner-facing totals for a single booking at the instructor's published
 * `hourlyRateSek`. `totalSek` is what the learner is actually charged —
 * school's published lesson price, with no separate DriveLinkUp fee.
 */
export interface LearnerTotals {
  priceSek: number;
  serviceFeeSek: number;
  totalSek: number;
}

export function learnerTotalSek(priceSek: number): LearnerTotals {
  if (!Number.isFinite(priceSek) || priceSek < 0) {
    throw new Error('priceSek must be a non-negative finite number');
  }
  const serviceFeeSek = percent(priceSek, LEARNER_SERVICE_FEE_PERCENT);
  return {
    priceSek: Math.round(priceSek),
    serviceFeeSek,
    totalSek: Math.round(priceSek) + serviceFeeSek,
  };
}

/**
 * Instructor-facing payout for a single booking at the instructor's
 * published `hourlyRateSek`. `payoutSek` is the amount released to the
 * instructor when the lesson is marked complete — lesson price minus 10%
 * attributable booking value after completion.
 */
export interface InstructorPayout {
  priceSek: number;
  commissionSek: number;
  payoutSek: number;
}

export function instructorPayoutSek(priceSek: number): InstructorPayout {
  if (!Number.isFinite(priceSek) || priceSek < 0) {
    throw new Error('priceSek must be a non-negative finite number');
  }
  const commissionSek = percent(priceSek, INSTRUCTOR_COMMISSION_PERCENT);
  return {
    priceSek: Math.round(priceSek),
    commissionSek,
    payoutSek: Math.round(priceSek) - commissionSek,
  };
}

/**
 * USD charge for Stripe-hosted checkout. Re-uses the SEK→USD ceiling helper
 * the existing payment flow uses so the booking-fee model and the legacy
 * single-rate flow cannot drift from each other on the currency ceiling.
 */
export function learnerTotalUsd(priceSek: number): number {
  const totals = learnerTotalSek(priceSek);
  return sekToUsdChargeAmount(totals.totalSek);
}
