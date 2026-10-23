import { describe, expect, it } from 'vitest';
import {
  claimScopeDecision,
  importedPolicyDraft,
  importSourceDecision,
  publicProspectDecision,
} from '@/lib/acquisition/claim-policy';

describe('claim policy', () => {
  it('SC-21 keeps a private prospect hidden and shows an eligible listing without a claim', () => {
    expect(
      publicProspectDecision({
        eligibility: 'PENDING',
        dataQuality: 'PENDING',
        claimState: 'UNCLAIMED',
      }).visible,
    ).toBe(false);
    expect(
      publicProspectDecision({
        eligibility: 'ELIGIBLE',
        dataQuality: 'PASS',
        claimState: 'UNCLAIMED',
      }).visible,
    ).toBe(true);
  });

  it('refuses a real register import and keeps an imported policy draft', () => {
    expect(importSourceDecision('REGISTER_SCRAPE')).toEqual({
      allowed: false,
      code: 'register_rights_unverified',
    });
    expect(importSourceDecision('SYNTHETIC_FIXTURE').allowed).toBe(true);
    expect(importedPolicyDraft('flexible')).toMatchObject({
      state: 'draft',
      approvedAt: null,
      source: 'legacy_tier',
      active: false,
    });
  });

  it('never grants commercial scopes from a verified claim', () => {
    expect(
      claimScopeDecision({
        identityStatus: 'VERIFIED',
        mandateStatus: 'VERIFIED',
        representativeStatus: 'VERIFIED',
      }),
    ).toEqual({
      scopesGranted: [],
      authorizationEventsCreated: 0,
      code: 'claim_does_not_grant_scopes',
    });
  });
});
