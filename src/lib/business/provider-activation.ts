// @polsia:user-owned — canonical provider activation definition.
//
// Marketplace supply is authorised driving schools only. Handledare /
// private-supervisor rows may exist for account history, but they are not
// bookable marketplace listings (see product + business plans).
import 'server-only';
import type { Prisma } from '@prisma/client';
import { isLicenceCategoryCode, LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';

export function isProviderActivated(categories: readonly string[]): boolean {
  return categories.some(isLicenceCategoryCode);
}

export function isMarketplaceSchoolRole(providerRole: string | null | undefined): boolean {
  // Learners book schools and certified instructors. Handledare stay out of supply.
  return providerRole !== 'HANDLEDARE';
}

export function buildProviderActivationWhere(): Prisma.InstructorWhereInput {
  return {
    AND: [
      { OR: LICENCE_CATEGORY_CODES.map((code) => ({ categories: { has: code } })) },
      // Null/legacy rows default to INSTRUCTOR (school listing). Explicit
      // HANDLEDARE rows stay out of the public directory and booking supply.
      {
        OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
      },
    ],
  };
}
