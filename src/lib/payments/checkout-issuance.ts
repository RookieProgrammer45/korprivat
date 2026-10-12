// Server-owned persisted claim, never a Stripe session id. The encoded payload
// freezes request parameters so recovery replays the same idempotent operation.
import { randomUUID } from 'node:crypto';
import type Stripe from 'stripe';

export const CHECKOUT_ISSUANCE_PREFIX = 'dlu_checkout_';

export function isCheckoutIssuanceClaim(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(CHECKOUT_ISSUANCE_PREFIX);
}

export function checkoutIssuanceClaimId(claim: string): string {
  return claim.split(':')[0] ?? claim;
}

export function checkoutIssuanceIdempotencyKey(bookingId: string, claim: string): string {
  return `checkout:booking:${bookingId}:${checkoutIssuanceClaimId(claim)}`;
}

export function newCheckoutIssuanceClaim(params: Stripe.Checkout.SessionCreateParams): string {
  const id = `${CHECKOUT_ISSUANCE_PREFIX}${randomUUID()}`;
  const frozen = { ...params, metadata: { ...params.metadata, checkoutClaimId: id } };
  return `${id}:${Buffer.from(JSON.stringify(frozen), 'utf8').toString('base64url')}`;
}

export function readCheckoutIssuanceParams(
  claim: string,
  bookingId: string,
): Stripe.Checkout.SessionCreateParams | null {
  if (!isCheckoutIssuanceClaim(claim)) return null;
  const encoded = claim.split(':')[1];
  if (!encoded || encoded.length > 16000) return null;
  try {
    const value = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    const item = value?.line_items?.[0];
    if (
      value?.mode !== 'payment' ||
      value?.metadata?.bookingId !== bookingId ||
      value?.metadata?.checkoutClaimId !== checkoutIssuanceClaimId(claim) ||
      typeof value.success_url !== 'string' ||
      typeof value.cancel_url !== 'string' ||
      !Array.isArray(value.line_items) ||
      value.line_items.length !== 1 ||
      item?.quantity !== 1 ||
      item?.price_data?.currency !== 'sek' ||
      !Number.isSafeInteger(item?.price_data?.unit_amount) ||
      item.price_data.unit_amount <= 0 ||
      Number(value.metadata.grossChargedSek) * 100 !== item.price_data.unit_amount
    )
      return null;
    for (const url of [value.success_url, value.cancel_url]) {
      const parsed = new URL(url);
      if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
        return null;
    }
    return value as Stripe.Checkout.SessionCreateParams;
  } catch {
    return null;
  }
}
