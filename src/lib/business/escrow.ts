//
// Shared primitives for the complete / dispute / dispute-resolve route
// handlers: per-booking unguessable token generation + matching, and a
// no-op known-contact hook kept for call-site compatibility (Resend does
// not require a separate contact-registration step).

import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * 32 hex chars (~128 bits of entropy) — unguessable per booking. Two
 * values are each independently safe, but we don't want to leak via
 * length-extension or guess-pruning, so a uniform 16-byte random is right.
 */
export function generateBookingToken(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Constant-time token match. Either side may be null/undefined (a row with
 * no token yet, or a malformed request); both fall through to `false`.
 */
export function assertTokenMatches(rowToken: string | null | undefined, supplied: string): boolean {
  if (typeof rowToken !== 'string' || rowToken.length === 0) return false;
  if (typeof supplied !== 'string' || supplied.length === 0) return false;
  if (rowToken.length !== supplied.length) return false;
  return timingSafeEqual(Buffer.from(rowToken, 'utf8'), Buffer.from(supplied, 'utf8'));
}

/**
 * No-op under Resend (contact registration is unused;
 * proxy for tier classification). Kept so existing call sites do not need
 * edits; always returns null.
 */
export async function registerKnownContact(_input: {
  email: string;
  name?: string;
  source: 'signup' | 'contact_form' | 'purchase' | 'invite' | 'import' | 'other';
}): Promise<number | null> {
  return null;
}
