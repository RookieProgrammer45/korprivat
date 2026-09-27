//
// Shared primitives for the complete / dispute / dispute-resolve route
// handlers: per-booking unguessable token generation + matching, and the
// email-proxy "register known contact" side effect that runs before the
// first transactional send to a learner who just paid.

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
 * Side effect: register the learner's email as a known contact on the
 * Polsia email proxy so transactional sends stay under the known-contact
 * tier (50/day) rather than the cold-outreach tier (2/day). Returns the
 * upstream HTTP status — non-2xx are silently ignored because lack of a
 * known-contact registration is a "won't deliver" risk, not a booking-
 * creation blocker; we still send the email and the proxy will retry the
 * classification on next send.
 */
export async function registerKnownContact(input: {
  email: string;
  name?: string;
  source: 'signup' | 'contact_form' | 'purchase' | 'invite' | 'import' | 'other';
}): Promise<number | null> {
  const apiKey = process.env.POLSIA_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch('https://polsia.com/api/proxy/email/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        email: input.email,
        name: input.name ?? undefined,
        source: input.source,
      }),
    });
    return res.status;
  } catch {
    return null;
  }
}
