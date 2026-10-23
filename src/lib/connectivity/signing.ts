import { createHmac, timingSafeEqual } from 'node:crypto';

const WINDOW_MS = 5 * 60 * 1000;

export function canonicalPartnerString(
  method: string,
  path: string,
  timestamp: string,
  body: string,
): string {
  return `${method.toUpperCase()}${path}${timestamp}${body}`;
}

export function signPartnerRequest(input: {
  secret: string;
  method: string;
  path: string;
  timestamp: string;
  body: string;
}): string {
  return createHmac('sha256', input.secret)
    .update(canonicalPartnerString(input.method, input.path, input.timestamp, input.body))
    .digest('hex');
}

export function timestampWithinWindow(timestamp: string, now: Date): boolean {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Math.abs(now.getTime() - parsed) <= WINDOW_MS;
}

export function signaturesMatch(expectedHex: string, providedHex: string): boolean {
  const expected = Buffer.from(expectedHex, 'utf8');
  const provided = Buffer.from(providedHex, 'utf8');
  if (expected.length !== provided.length) return false;
  return timingSafeEqual(expected, provided);
}

export function partnerSecret(
  credentialId: string,
  raw = process.env.CONNECTIVITY_PARTNER_SECRETS,
): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const secret = parsed[credentialId];
    return typeof secret === 'string' && secret.length > 0 ? secret : null;
  } catch {
    return null;
  }
}

export function canSignForEnvironment(
  credentialEnvironment: string,
  targetEnvironment: string,
): boolean {
  return credentialEnvironment === targetEnvironment;
}
