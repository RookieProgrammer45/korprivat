export function isConciergeOnboardingOn(
  env: string | undefined = process.env.CONCIERGE_ONBOARDING,
): boolean {
  return env === '1' || env === 'true';
}

export type ConciergeProvenance = {
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  fields: string[];
};

export const NO_MANUFACTURED = {
  policyApproved: false,
  verificationManufactured: false,
  authorizationEventsCreated: 0,
  scopesGranted: [] as [],
  bookingSurfaces: false,
};

export function isConciergeProvenance(value: unknown): value is ConciergeProvenance {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.source === 'string' &&
    row.source.length > 0 &&
    typeof row.sourceUrl === 'string' &&
    row.sourceUrl.length > 0 &&
    typeof row.retrievedAt === 'string' &&
    row.retrievedAt.length > 0 &&
    Array.isArray(row.fields) &&
    row.fields.every((field) => typeof field === 'string')
  );
}

export function conciergeSourceDecision(source: string): { allowed: boolean; code: string } {
  if (source === 'SYNTHETIC_FIXTURE') return { allowed: true, code: 'synthetic_fixture' };
  return { allowed: false, code: 'register_rights_unverified' };
}

export function conciergePayloadHasScopes(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const row = payload as Record<string, unknown>;
  return Array.isArray(row.scopes) || Array.isArray(row.grantedScopes);
}

export function conciergeStoreDecision(input: {
  source: string;
  provenance: unknown;
  payload?: unknown;
}):
  | ({ allowed: true; state: 'DRAFT'; published: false } & typeof NO_MANUFACTURED)
  | {
      allowed: false;
      code: 'provenance_required' | 'register_rights_unverified' | 'scopes_not_prefillable';
    } {
  if (conciergePayloadHasScopes(input.payload)) {
    return { allowed: false, code: 'scopes_not_prefillable' };
  }
  if (!isConciergeProvenance(input.provenance)) {
    return { allowed: false, code: 'provenance_required' };
  }
  const source = conciergeSourceDecision(input.source);
  if (!source.allowed) return { allowed: false, code: 'register_rights_unverified' };
  return { allowed: true, state: 'DRAFT', published: false, ...NO_MANUFACTURED };
}

export function conciergeApprovalDecision(input: {
  representativeVerified: boolean;
}):
  | ({ allowed: true; state: 'SCHOOL_APPROVED'; published: false } & typeof NO_MANUFACTURED)
  | { allowed: false; code: 'not_representative' } {
  if (!input.representativeVerified) return { allowed: false, code: 'not_representative' };
  return { allowed: true, state: 'SCHOOL_APPROVED', published: false, ...NO_MANUFACTURED };
}

export function conciergePublishDecision(input: { schoolApproved: boolean }):
  | ({ allowed: true; state: 'PUBLISHED'; published: true } & typeof NO_MANUFACTURED)
  | ({ allowed: false; code: 'school_approval_required' } & typeof NO_MANUFACTURED & {
        published: false;
      }) {
  if (!input.schoolApproved) {
    return {
      allowed: false,
      code: 'school_approval_required',
      published: false,
      ...NO_MANUFACTURED,
    };
  }
  return { allowed: true, state: 'PUBLISHED', published: true, ...NO_MANUFACTURED };
}
