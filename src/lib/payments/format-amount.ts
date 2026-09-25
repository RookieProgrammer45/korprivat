// @polsia:user-owned — single source of truth for SEK↔USD conversion in the
// DriveLinkUp booking payment flow.
//
// The `stripe-billing` module's `createCheckoutSession` helper is USD-only and
// rejects anything below $1. DriveLinkUp prices lessons in integer SEK, so this
// helper owns the conversion. Every server route that mints a Stripe checkout
// from a SEK rate calls `sekToUsdChargeAmount(instructor.hourlyRateSek)`; the
// Stripe checkout URL it returns carries the USD value the learner was actually
// charged, never the SEK label.
//
// The rate is intentionally flat. This app is not a forex service; a single
// declared rate keeps the policy auditable and prevents per-charge drift. Tuned
// so the smallest drive-school booking rate (450 SEK/hr — see the seed file)
// cleanly converts to ≥ $1 USD, and so larger SEK values round to whole-dollar
// USD charges the Stripe checkout minimum accepts without complaint.
const SEK_TO_USD_RATE = 0.094;

export function sekToUsdChargeAmount(hourlyRateSek: number): number {
  if (!Number.isFinite(hourlyRateSek) || hourlyRateSek <= 0) {
    throw new Error('hourlyRateSek must be a positive number');
  }
  const raw = hourlyRateSek * SEK_TO_USD_RATE;
  // Stripe's `createCheckoutSession` minimum is $1 USD and the schema accepts
  // only integers in `amountUsd`. Round up to the nearest whole dollar so a
  // SEK rate that's slightly short of the next dollar still presents the
  // learner a working checkout. Math.max guards against the helper ever
  // reporting $0 when given a sub-dollar SEK rate.
  return Math.max(1, Math.ceil(raw));
}

export const USD_RATE_DOC = {
  sekToUsd: SEK_TO_USD_RATE,
  notes: '1 SEK → 0.094 USD, rounded up to the nearest whole dollar. Single source of truth.',
};
