// rule + fee math. Every code path that decides "is this cancel free, partial,
// or full-fee" — the cancel API route (server-only), the cancel client form
// (browser island for the pre-confirm preview), and the booking form (the
// learner-side tier banner) — imports from here so the three views can never
// diverge on what counts as "late".
//
// Why constants and not a DB row today: the marketplace is single-tenant.
// Promoting `POLICIES` to per-instructor config (it already IS per-instructor
// via `Instructor.cancellationPolicyTier`, with this module just mapping the
// enum to the math) is the next step — nothing else changes here, just the
// caller reads `tier` off the booking / instructor row instead of a const.

// ───── Tier model ──────────────────────────────────────────────────────

export type CancellationTier = 'flexible' | 'moderate' | 'strict';

export const CANCELLATION_TIERS: readonly CancellationTier[] = [
  'flexible',
  'moderate',
  'strict',
] as const;

export function isCancellationTier(value: unknown): value is CancellationTier {
  return typeof value === 'string' && (CANCELLATION_TIERS as readonly string[]).includes(value);
}

/**
 * Per-tier policy description. Uses the marketplace's three policy buckets:
 *   fullRefundBeforeHours   — full refund when cancellation comes AT LEAST this
 *                             many hours before `preferredAt`.
 *   partialRefundWindowHours— between `fullRefundBeforeHours` and
 *                             `fullFeeWindowHours`, the partial fee applies.
 *   partialFeePercent       — percent of the lesson charge retained on the
 *                             partial window. 0 for `flexible` (no partial band).
 *   fullFeeWindowHours      — within this many hours of `preferredAt` the fee
 *                             is 100% of the lesson charge.
 */
export interface CancellationPolicy {
  tier: CancellationTier;
  fullRefundBeforeHours: number;
  partialRefundWindowHours: number;
  partialFeePercent: number;
  fullFeeWindowHours: number;
}

export const POLICIES: Record<CancellationTier, CancellationPolicy> = {
  flexible: {
    tier: 'flexible',
    fullRefundBeforeHours: 24,
    partialRefundWindowHours: 24,
    partialFeePercent: 0,
    fullFeeWindowHours: 24,
  },
  moderate: {
    tier: 'moderate',
    fullRefundBeforeHours: 120,
    partialRefundWindowHours: 24,
    partialFeePercent: 50,
    fullFeeWindowHours: 24,
  },
  strict: {
    tier: 'strict',
    fullRefundBeforeHours: 168,
    partialRefundWindowHours: 24,
    partialFeePercent: 50,
    fullFeeWindowHours: 24,
  },
};

/**
 * Look up the policy record for an arbitrary stored tier. Falls back to
 * `flexible` for `null` / `undefined` / a corrupt string so the cancel and
 * preview code paths can never crash on a missing column — the bumped-down
 * refund is the worst case (a strict-tier learner who somehow lost their
 * tier field is treated as flexible, which is strictly worse for the
 * platform, never for the learner in this fallback).
 */
export function getPolicyForTier(tier: string | null | undefined): CancellationPolicy {
  if (tier && (CANCELLATION_TIERS as readonly string[]).includes(tier)) {
    return POLICIES[tier as CancellationTier];
  }
  return POLICIES.flexible;
}

// ───── Outcome classification ──────────────────────────────────────────

export type CancellationOutcomeKind = 'full_refund' | 'partial' | 'late' | 'past';

export interface CancellationOutcome {
  kind: CancellationOutcomeKind;
  feePercent: number;
}

/**
 * Inspect the time remaining until the lesson and decide which bucket this
 * cancel falls into:
 *   - 'full_refund' — outside the tier's fullRefundBeforeHours. No fee.
 *                     Maps to `cancelled_full_refund` on the booking row.
 *   - 'partial'     — between fullRefundBeforeHours and fullFeeWindowHours
 *                     (the partial window). Tier-supplied partialFeePercent.
 *                     Maps to `cancelled_partial`.
 *   - 'late'        — within the tier's fullFeeWindowHours (24h by default).
 *                     100% fee. Maps to `cancelled_late`.
 *   - 'past'        — at or after the lesson start. Cannot cancel via this
 *                     route — dispute is the right channel. Maps to a 409.
 *
 * Pure: does NOT touch the DB, does NOT throw. The route handler maps each
 * kind to its own gate (200 for the three resolvable kinds + 409 for past).
 */
export function classifyCancellationOutcome(
  now: Date,
  preferredAt: Date,
  policy: CancellationPolicy,
): CancellationOutcome {
  const nowMs = now.getTime();
  const lessonMs = preferredAt.getTime();
  if (nowMs >= lessonMs) {
    return { kind: 'past', feePercent: policy.partialFeePercent };
  }
  const fullFeeMs = policy.fullFeeWindowHours * 60 * 60 * 1000;
  const fullRefundMs = policy.fullRefundBeforeHours * 60 * 60 * 1000;
  // Honour the determinism of the existing `cancellationWindow` rule: a
  // cancel EXACTLY at the window boundary is treated as the stricter bucket
  // (it's "inside the window" with `<=`), so the learner gets a stable
  // reading at the boundary edge.
  if (lessonMs - nowMs <= fullFeeMs) {
    return { kind: 'late', feePercent: 100 };
  }
  if (lessonMs - nowMs <= fullRefundMs) {
    return { kind: 'partial', feePercent: policy.partialFeePercent };
  }
  return { kind: 'full_refund', feePercent: 0 };
}

// ───── Fee math (legacy + new, both kept) ──────────────────────────────

// Legacy single-window constants — used by the LEGACY `cancellationWindow`
// / `computeLateFeeUsd` helpers that existing call sites still import.
// Kept as thin re-exports so older call sites (and unit tests that pin the
// old rule) keep working. New code should call `classifyCancellationOutcome`
// + `computeCancellationFeeUsd` instead.
export const LATE_WINDOW_HOURS = 24;
export const LATE_FEE_PERCENT = 25;

export function cancellationWindow(now: Date, preferredAt: Date): 'late' | 'early' | 'past' {
  const nowMs = now.getTime();
  const lessonMs = preferredAt.getTime();
  const windowMs = LATE_WINDOW_HOURS * 60 * 60 * 1000;
  if (nowMs >= lessonMs) return 'past';
  if (lessonMs - nowMs <= windowMs) return 'late';
  return 'early';
}

export function computeLateFeeUsd(
  lessonChargeUsd: number,
  percent: number = LATE_FEE_PERCENT,
): number {
  if (!Number.isFinite(lessonChargeUsd) || lessonChargeUsd <= 0) {
    throw new Error('lessonChargeUsd must be a positive number');
  }
  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
    throw new Error('percent must be between 0 and 100');
  }
  const raw = Math.ceil((lessonChargeUsd * percent) / 100);
  return Math.min(lessonChargeUsd, Math.max(0, raw));
}

/**
 * Compute the USD fee for an outcome-classified cancel. `feePercent` is the
 * percent (0–100) returned by `classifyCancellationOutcome`. Capped at the
 * lesson charge so a fee can never exceed what was charged. `Math.ceil`
 * matches the existing "fee rounds up so the policy is at least this much"
 * convention. Throws on non-positive input so a caller can't silently pass
 * a zero / negative charge and end up with no audit row.
 */
export function computeCancellationFeeUsd(lessonChargeUsd: number, feePercent: number): number {
  if (!Number.isFinite(lessonChargeUsd) || lessonChargeUsd <= 0) {
    throw new Error('lessonChargeUsd must be a positive number');
  }
  if (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100) {
    throw new Error('feePercent must be between 0 and 100');
  }
  const raw = Math.ceil((lessonChargeUsd * feePercent) / 100);
  return Math.min(lessonChargeUsd, Math.max(0, raw));
}

/**
 * Whole-hours remaining until the lesson start — snapshotted into the
 * `LateCancellationFee.windowHoursAtCancel` audit column. Floors down
 * (`Math.floor`) so the operator reading the row can compare to the tier
 * window cleanly without sub-hour jitter.
 */
export function hoursUntilLesson(now: Date, preferredAt: Date): number {
  const deltaMs = preferredAt.getTime() - now.getTime();
  if (!Number.isFinite(deltaMs)) return 0;
  return Math.max(0, Math.floor(deltaMs / (60 * 60 * 1000)));
}
