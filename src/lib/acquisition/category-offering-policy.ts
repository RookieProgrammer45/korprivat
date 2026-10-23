export const OFFERING_CATEGORIES = [
  'AM',
  'A1',
  'A2',
  'A',
  'B',
  'BE',
  'C',
  'C1',
  'CE',
  'D',
  'D1',
  'DE',
] as const;

export type OfferingCategory = (typeof OFFERING_CATEGORIES)[number];

export function isCategoryOfferingsOn(
  env: string | undefined = process.env.CATEGORY_OFFERINGS,
): boolean {
  return env === '1' || env === 'true';
}

export function isOfferingCategory(value: string): value is OfferingCategory {
  return (OFFERING_CATEGORIES as readonly string[]).includes(value);
}

export type TeachingPermissionFact = {
  category: string;
  legalEntityRef: string;
  locationRef: string;
  status: string;
};

/** The submitted category is a tag. Permission comes from the stored fact. */
export function offeringPublicationDecision(input: {
  enforced: boolean;
  offeringCategory: string | null;
  permissions: TeachingPermissionFact[];
  listingLegalEntity: string;
  listingLocation: string;
}): { allowed: boolean; code: string } {
  if (!input.enforced) return { allowed: true, code: 'unchanged' };
  if (!input.offeringCategory) return { allowed: false, code: 'category_required' };
  if (!input.listingLegalEntity || !input.listingLocation) {
    return { allowed: false, code: 'legal_entity_unmatched' };
  }
  const matched = input.permissions.some(
    (permission) =>
      permission.status === 'CURRENT' &&
      permission.category === input.offeringCategory &&
      permission.legalEntityRef === input.listingLegalEntity &&
      permission.locationRef === input.listingLocation,
  );
  if (!matched) return { allowed: false, code: 'category_not_permitted' };
  return { allowed: true, code: 'teaching_permission_matched' };
}

export function offeringPolicySelection(input: {
  policy: {
    id: string;
    listingId: string;
    version: number;
    approvedAt: string | null;
    state: string;
  } | null;
  listingId: string;
}):
  | { ok: true; snapshot: { policyId: string; version: number } }
  | { ok: false; code: 'policy_missing' | 'policy_unapproved' | 'policy_listing_mismatch' } {
  if (!input.policy) return { ok: false, code: 'policy_missing' };
  if (input.policy.listingId !== input.listingId) {
    return { ok: false, code: 'policy_listing_mismatch' };
  }
  if (input.policy.state !== 'active' || !input.policy.approvedAt) {
    return { ok: false, code: 'policy_unapproved' };
  }
  return { ok: true, snapshot: { policyId: input.policy.id, version: input.policy.version } };
}

export function categoryBookingSnapshot(input: {
  offeringId: string;
  category: string;
  policyId: string | null;
  policyVersion: number | null;
}): {
  offeringId: string;
  category: string;
  policyId: string | null;
  policyVersion: number | null;
} {
  return {
    offeringId: input.offeringId,
    category: input.category,
    policyId: input.policyId,
    policyVersion: input.policyVersion,
  };
}
