//
// DriveLinkUp does not add a learner service fee. A new booking charges only
// the school's published lesson price. Platform commission is taken from
// attributable booking value after completed service:
//   - 10% for independent instructors
//   - 8% for school-affiliated bookings (organizationId set) — ADR-004
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
export const SCHOOL_COMMISSION_PERCENT = 8;

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
 * Instructor/school-facing payout for a single booking. `payoutSek` is the
 * amount released when the lesson is marked complete — lesson price minus
 * commission (10% independent, 8% when `organizationId` is set).
 */
export interface InstructorPayout {
  priceSek: number;
  commissionSek: number;
  payoutSek: number;
  commissionPercent: number;
}

export type InstructorPayoutOpts = {
  organizationId?: string | null;
};

export function instructorPayoutSek(
  priceSek: number,
  opts?: InstructorPayoutOpts,
): InstructorPayout {
  if (!Number.isFinite(priceSek) || priceSek < 0) {
    throw new Error('priceSek must be a non-negative finite number');
  }
  const commissionPercent = opts?.organizationId
    ? SCHOOL_COMMISSION_PERCENT
    : INSTRUCTOR_COMMISSION_PERCENT;
  const commissionSek = percent(priceSek, commissionPercent);
  return {
    priceSek: Math.round(priceSek),
    commissionSek,
    payoutSek: Math.round(priceSek) - commissionSek,
    commissionPercent,
  };
}

/** Alias for fee breakdown used by payout / receipt call sites. */
export function computeFees(priceSek: number, opts?: InstructorPayoutOpts): InstructorPayout {
  return instructorPayoutSek(priceSek, opts);
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
