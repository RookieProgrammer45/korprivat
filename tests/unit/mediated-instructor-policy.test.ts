import { describe, expect, it } from 'vitest';
import {
  independentPublicationDecision,
  inventoryDiaryDecision,
  invitationCategoryDecision,
  offeringCategoryDecision,
  scopeGrantByRoleDecision,
} from '@/lib/acquisition/mediated-instructor-policy';

describe('school-mediated instructor policy', () => {
  it('SC-23 refuses independent publication and sale, and keeps a native diary closed without delegation', () => {
    expect(
      independentPublicationDecision({
        enforced: true,
        providerRole: 'INSTRUCTOR',
        affiliationVerified: false,
      }).code,
    ).toBe('independent_publication_refused');
    expect(
      offeringCategoryDecision({
        enforced: true,
        providerRole: 'INSTRUCTOR',
        affiliationVerified: true,
        offeringCategories: ['C'],
        schoolCategories: ['B'],
      }).code,
    ).toBe('category_not_permitted');
    expect(
      inventoryDiaryDecision({
        enforced: true,
        providerRole: 'INSTRUCTOR',
        affiliationVerified: true,
        inventoryDelegated: false,
      }).code,
    ).toBe('inventory_not_delegated');
    expect(
      inventoryDiaryDecision({
        enforced: true,
        providerRole: 'INSTRUCTOR',
        affiliationVerified: true,
        inventoryDelegated: true,
      }).allowed,
    ).toBe(true);
  });

  it('lets a verified representative act, and refuses a grant based only on the instructor role', () => {
    expect(
      scopeGrantByRoleDecision({
        enforced: true,
        actorIsSchool: false,
        representativeVerified: false,
      }).code,
    ).toBe('instructor_role_cannot_grant_scopes');
    expect(
      scopeGrantByRoleDecision({
        enforced: true,
        actorIsSchool: false,
        representativeVerified: true,
      }).allowed,
    ).toBe(true);
  });

  it('leaves the live instructor path unchanged while the flag is off', () => {
    expect(
      independentPublicationDecision({
        enforced: false,
        providerRole: 'INSTRUCTOR',
        affiliationVerified: false,
      }).allowed,
    ).toBe(true);
    expect(invitationCategoryDecision(['B'], ['A']).code).toBe('category_not_permitted');
    expect(invitationCategoryDecision(['A', 'B', 'C', 'D'], ['C', 'D']).allowed).toBe(true);
  });
});
