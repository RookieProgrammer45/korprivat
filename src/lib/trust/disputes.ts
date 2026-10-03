// Trust bounded context — dispute helpers (Payments still owns Stripe refunds/payouts).
// Pure module — safe for unit tests without server-only.

/**
 * Partial dispute math (ADR-005): reduce instructor payout by refunded SEK,
 * then release the remainder via Connect transfer. Do not invent a second ledger.
 *
 * Example: gross 500, commission 10% → payout snapshot 450.
 * Partial refund 200 to learner → transfer min(payoutSnapshot, gross - refund - platformKeep)
 * Simplest v1: transfer = max(0, payoutAmountSek - refundSek).
 */
export function partialPayoutAfterRefund(input: {
  payoutAmountSek: number;
  refundSek: number;
}): { transferSek: number; refundSek: number } {
  const refundSek = Math.max(0, Math.round(input.refundSek));
  const payoutAmountSek = Math.max(0, Math.round(input.payoutAmountSek));
  return {
    refundSek,
    transferSek: Math.max(0, payoutAmountSek - refundSek),
  };
}
