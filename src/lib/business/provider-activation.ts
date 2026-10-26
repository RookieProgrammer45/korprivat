//
// Marketplace supply is authorised driving schools only. Handledare /
// private-supervisor rows may exist for account history, but they are not
// bookable marketplace listings (see product + business plans).
import 'server-only';
import type { Prisma } from '@prisma/client';
import { isLicenceCategoryCode, LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import { prisma } from '@/lib/db';
import { publishedListingWhere } from '@/lib/discovery/published-prices';

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
 * marketplace categories, not HANDLEDARE, InstructorLicense VERIFIED, and at
 * least one price published on the school's website.
 */
export async function buildVerifiedProviderActivationWhere(): Promise<Prisma.InstructorWhereInput> {
  const verified = await prisma.instructorLicense.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true },
  });
  const verifiedUserIds = verified.map((r) => r.userId);
  const categoryAndRole: Prisma.InstructorWhereInput[] = [
    { OR: LICENCE_CATEGORY_CODES.map((code) => ({ categories: { has: code } })) },
    {
      OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
    },
    publishedListingWhere(),
  ];
  if (verifiedUserIds.length === 0) {
    return { AND: [...categoryAndRole, { id: { in: [] } }] };
  }

  const ownerOrgs = await prisma.membership.findMany({
    where: { status: 'ACTIVE', role: 'OWNER', userId: { in: verifiedUserIds } },
    select: { organizationId: true },
  });
  const eligibleOrgIds = [...new Set(ownerOrgs.map((row) => row.organizationId))];
  const staff =
    eligibleOrgIds.length === 0
      ? []
      : await prisma.membership.findMany({
          where: { status: 'ACTIVE', organizationId: { in: eligibleOrgIds } },
          select: { userId: true },
        });
  const catalogUserIds = [...new Set([...verifiedUserIds, ...staff.map((row) => row.userId)])];
  return {
    AND: [...categoryAndRole, { userId: { in: catalogUserIds } }],
  };
}
