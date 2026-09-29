// DriveLinkUp booking payment helpers.
//
// Integer SEK ↔ legacy USD ceiling conversion for receipt/snapshot fields that
// still expect a USD-ish major-unit amount. Checkout itself charges SEK öre
// via Stripe Checkout; do not use this helper to mint checkout line items.
const SEK_TO_USD_RATE = 0.094;

export function sekToUsdChargeAmount(hourlyRateSek: number): number {
  if (!Number.isFinite(hourlyRateSek) || hourlyRateSek <= 0) {
    throw new Error('hourlyRateSek must be a positive number');
  }
  const raw = hourlyRateSek * SEK_TO_USD_RATE;
  // Round up to the nearest whole dollar so legacy USD snapshot floors stay ≥ $1.
  return Math.max(1, Math.ceil(raw));
}

export const USD_RATE_DOC = {
  sekToUsd: SEK_TO_USD_RATE,
  notes: '1 SEK → 0.094 USD, rounded up to the nearest whole dollar. Single source of truth.',
};
