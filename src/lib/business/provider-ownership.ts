// @polsia:user-owned — one authenticated provider ownership resolver.
import 'server-only';
import { prisma } from '@/lib/db';
import type { SessionUser } from '@/lib/require-auth';

export const PROVIDER_ROLES = ['INSTRUCTOR', 'HANDLEDARE'] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export type OwnedProvider = {
  id: string;
  name: string;
  city: string;
  email: string | null;
  userId: string | null;
  providerRole: ProviderRole;
  categories: string[];
  hourlyRateSek: number;
  bio: string;
  photoUrl: string;
  serviceArea: string | null;
  englishSpeaking: boolean;
  cancellationPolicyTier: string | null;
  bookingMode: string | null;
};

export class ProviderOwnershipError extends Error {
  readonly reason: 'missing' | 'ambiguous' | 'wrong-role';

  constructor(reason: 'missing' | 'ambiguous' | 'wrong-role') {
    super(reason);
    this.name = 'ProviderOwnershipError';
    this.reason = reason;
  }
}

function normalizeRole(value: string | null | undefined): ProviderRole {
  return value === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR';
}

export function providerRoleOf(value: string | null | undefined): ProviderRole {
  return normalizeRole(value);
}

/**
 * Resolve a single provider row. Explicit userId ownership always wins.
 * A legacy email-owned row is claimed only when it is the sole candidate;
 * multiple candidates are rejected instead of silently attaching the wrong
 * provider profile to an account.
 */
export async function resolveOwnedProvider(
  user: SessionUser,
  allowedRoles: readonly ProviderRole[] = PROVIDER_ROLES,
): Promise<OwnedProvider | null> {
  const byUser = await prisma.instructor.findMany({
    where: { userId: user.id },
    orderBy: { id: 'asc' },
  });
  if (byUser.length > 1) throw new ProviderOwnershipError('ambiguous');

  let provider = byUser[0];
  if (!provider) {
    const email = user.email.trim().toLowerCase();
    const byEmail = await prisma.instructor.findMany({
      where: { email: { equals: email, mode: 'insensitive' }, userId: null },
      orderBy: { id: 'asc' },
    });
    if (byEmail.length > 1) throw new ProviderOwnershipError('ambiguous');
    const candidate = byEmail[0];
    if (candidate) {
      provider = await prisma.instructor.update({
        where: { id: candidate.id },
        data: { userId: user.id },
      });
    }
  }
  if (!provider) return null;

  const role = normalizeRole(provider.providerRole);
  if (!allowedRoles.includes(role)) throw new ProviderOwnershipError('wrong-role');
  return { ...provider, providerRole: role };
}

export function providerOwnershipErrorResponse(error: unknown): {
  status: 403 | 409;
  message: string;
} | null {
  if (!(error instanceof ProviderOwnershipError)) return null;
  return error.reason === 'ambiguous'
    ? { status: 409, message: 'Provider ownership needs operator review.' }
    : { status: 403, message: 'This provider profile is not available for this account.' };
}
