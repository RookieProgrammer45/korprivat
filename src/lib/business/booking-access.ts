import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

type LearnerAccessCredentials = {
  token: string;
  tokenHash: string;
};

export function generateLearnerAccessToken(): LearnerAccessCredentials {
  const token = randomBytes(32).toString('hex');
  return { token, tokenHash: hashLearnerAccessToken(token) };
}

export function hashLearnerAccessToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function matchesLearnerAccessToken(
  expectedHash: string | null | undefined,
  suppliedToken: string | null | undefined,
): boolean {
  if (!expectedHash || !suppliedToken) return false;
  const expected = Buffer.from(expectedHash, 'hex');
  const supplied = Buffer.from(hashLearnerAccessToken(suppliedToken), 'hex');
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

/** Read the opaque token from Authorization first, then the email deep link. */
export function getBookingAccessToken(req: Request): string | null {
  const authorization = req.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1]) return match[1].trim();
  }

  try {
    const token = new URL(req.url).searchParams.get('token');
    return token?.trim() || null;
  } catch {
    return null;
  }
}
