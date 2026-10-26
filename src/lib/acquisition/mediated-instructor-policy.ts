import { TEACHING_CATEGORIES, type TeachingCategory } from '@/lib/acquisition/claim-policy';

export function isSchoolMediatedInstructorsOn(
  env: string | undefined = process.env.SCHOOL_MEDIATED_INSTRUCTORS,
): boolean {
  return env === '1' || env === 'true';
}

export function isTeachingCategory(value: string): value is TeachingCategory {
  return (TEACHING_CATEGORIES as readonly string[]).includes(value);
}

/** Payment is collected only by a school, or by an instructor through a school. */
export function instructorPaymentDecision(input: {
  providerRole: string | null | undefined;
  affiliationVerified: boolean;
}): { allowed: boolean; code: string } {
  if (input.providerRole === 'HANDLEDARE') {
    return { allowed: false, code: 'handledare_not_payable' };
  }
  if (input.providerRole === 'SCHOOL') {
    return { allowed: true, code: 'school_listing' };
  }
  if (input.affiliationVerified) return { allowed: true, code: 'school_affiliated' };
  return { allowed: false, code: 'independent_payment_refused' };
}

export function independentPublicationDecision(input: {
  enforced: boolean;
  providerRole: string;
  affiliationVerified: boolean;
}): { allowed: boolean; code: string } {
  if (!input.enforced || input.providerRole !== 'INSTRUCTOR') {
    return { allowed: true, code: 'unchanged' };
  }
  if (input.affiliationVerified) return { allowed: true, code: 'school_affiliated' };
  return { allowed: false, code: 'independent_publication_refused' };
}

export function offeringCategoryDecision(input: {
  enforced: boolean;
  providerRole: string;
  affiliationVerified: boolean;
  offeringCategories: string[];
  schoolCategories: string[];
}): { allowed: boolean; code: string } {
  if (!input.enforced || input.providerRole !== 'INSTRUCTOR') {
    return { allowed: true, code: 'unchanged' };
  }
  if (!input.affiliationVerified) return { allowed: false, code: 'independent_sale_refused' };
  if (input.offeringCategories.length === 0) {
    return { allowed: false, code: 'category_permission_required' };
  }
  const school = new Set(input.schoolCategories);
  if (input.offeringCategories.some((category) => !school.has(category))) {
    return { allowed: false, code: 'category_not_permitted' };
  }
  return { allowed: true, code: 'within_school_categories' };
}

export function inventoryDiaryDecision(input: {
  enforced: boolean;
  providerRole: string;
  affiliationVerified: boolean;
  inventoryDelegated: boolean;
}): { allowed: boolean; code: string } {
  if (!input.enforced || input.providerRole !== 'INSTRUCTOR') {
    return { allowed: true, code: 'unchanged' };
  }
  if (input.affiliationVerified && input.inventoryDelegated) {
    return { allowed: true, code: 'delegated_inventory' };
  }
  return { allowed: false, code: 'inventory_not_delegated' };
}

export function scopeGrantByRoleDecision(input: {
  enforced: boolean;
  actorIsSchool: boolean;
  representativeVerified: boolean;
}): { allowed: boolean; code: string } {
  if (!input.enforced || input.representativeVerified || input.actorIsSchool) {
    return { allowed: true, code: 'existing_representative_check' };
  }
  return { allowed: false, code: 'instructor_role_cannot_grant_scopes' };
}

export function invitationCategoryDecision(
  schoolCategories: string[],
  requested: string[],
): { allowed: boolean; code: string } {
  if (requested.length === 0) return { allowed: false, code: 'category_permission_required' };
  const school = new Set(schoolCategories);
  if (requested.some((category) => !school.has(category))) {
    return { allowed: false, code: 'category_not_permitted' };
  }
  return { allowed: true, code: 'within_school_categories' };
}
