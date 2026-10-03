//
// Marketplace supply is authorised driving schools only. Handledare /
// private-supervisor rows may exist for account history, but they are not
// bookable marketplace listings (see product + business plans).
import 'server-only';
import type { Prisma } from '@prisma/client';
import { isLicenceCategoryCode, LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import { prisma } from '@/lib/db';

export function isProviderActivated(categories: readonly string[]): boolean {
  return categories.some(isLicenceCategoryCode);
}

export function isMarketplaceSchoolRole(providerRole: string | null | undefined): boolean {
  // Learners book schools and certified instructors. Handledare stay out of supply.
  return providerRole !== 'HANDLEDARE';
}

/** Category + role filter only (no licence). Prefer buildVerifiedProviderActivationWhere. */
export function buildProviderActivationWhere(): Prisma.InstructorWhereInput {
  return {
    AND: [
      { OR: LICENCE_CATEGORY_CODES.map((code) => ({ categories: { has: code } })) },
      {
        OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
      },
    ],
  };
}

/**
 * Public directory / search eligibility (AGENTS.md invariant 6):
 * marketplace categories, not HANDLEDARE, and InstructorLicense VERIFIED.
 */
export async function buildVerifiedProviderActivationWhere(): Promise<Prisma.InstructorWhereInput> {
  const verified = await prisma.instructorLicense.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true },
  });
  const verifiedUserIds = verified.map((r) => r.userId);
  return {
    AND: [
      { OR: LICENCE_CATEGORY_CODES.map((code) => ({ categories: { has: code } })) },
      {
        OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
      },
      verifiedUserIds.length > 0
        ? { userId: { in: verifiedUserIds } }
        : { id: { in: [] } },
    ],
  };
}
