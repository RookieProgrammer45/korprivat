import {
  draftPolicyFromLegacyTier,
  type LegacyCancellationTier,
} from '@/lib/scheduling/booking-policy';

export const TEACHING_CATEGORIES = ['A', 'B', 'C', 'D'] as const;
export type TeachingCategory = (typeof TEACHING_CATEGORIES)[number];

export function isClaimFunnelOn(env: string | undefined = process.env.CLAIM_FUNNEL): boolean {
  return env === '1' || env === 'true';
}

export function importSourceDecision(source: string): { allowed: boolean; code: string } {
  if (source === 'SYNTHETIC_FIXTURE') return { allowed: true, code: 'synthetic_fixture' };
  return { allowed: false, code: 'register_rights_unverified' };
}

export function publicProspectDecision(input: {
  eligibility: string;
  dataQuality: string;
  claimState: string;
}): { visible: boolean } {
  return {
    visible: input.eligibility === 'ELIGIBLE' && input.dataQuality === 'PASS',
  };
}

export function claimScopeDecision(input: {
  identityStatus: string;
  mandateStatus: string;
  representativeStatus: string;
}): {
  scopesGranted: [];
  authorizationEventsCreated: 0;
  code: 'verification_incomplete' | 'claim_does_not_grant_scopes';
} {
  const verified =
    input.identityStatus === 'VERIFIED' &&
    input.mandateStatus === 'VERIFIED' &&
    input.representativeStatus === 'VERIFIED';
  if (!verified) {
    return {
      scopesGranted: [],
      authorizationEventsCreated: 0,
      code: 'verification_incomplete',
    };
  }
  return {
    scopesGranted: [],
    authorizationEventsCreated: 0,
    code: 'claim_does_not_grant_scopes',
  };
}

export function importedPolicyDraft(tier: LegacyCancellationTier | null) {
  if (!tier) return null;
  return draftPolicyFromLegacyTier(tier);
}
