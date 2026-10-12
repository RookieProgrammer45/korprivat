import 'server-only';

export type CheckoutAmountValidation =
  | { ok: true; amountSek: number }
  | { ok: false; reason: 'currency' | 'amount' | 'missing_frozen_amount' | 'amount_mismatch' };

/**
 * Stripe reports Checkout totals in the smallest currency unit. DriveLinkUp's
 * booking flow is SEK-only, and fulfillment is allowed only when that total
 * equals the booking's immutable gross SEK snapshot exactly.
 */
export function validateBookingCheckoutAmount(input: {
  currency: string | null | undefined;
  amountTotal: number | null | undefined;
  grossChargedSek: number | null | undefined;
}): CheckoutAmountValidation {
  if (input.currency?.toLowerCase() !== 'sek') return { ok: false, reason: 'currency' };
  if (
    !Number.isSafeInteger(input.amountTotal) ||
    input.amountTotal == null ||
    input.amountTotal <= 0 ||
    input.amountTotal % 100 !== 0
  ) {
    return { ok: false, reason: 'amount' };
  }
  if (!Number.isSafeInteger(input.grossChargedSek) || input.grossChargedSek == null) {
    return { ok: false, reason: 'missing_frozen_amount' };
  }
  const amountSek = input.amountTotal / 100;
  if (amountSek !== input.grossChargedSek) return { ok: false, reason: 'amount_mismatch' };
  return { ok: true, amountSek };
}
