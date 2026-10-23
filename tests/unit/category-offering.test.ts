import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  categoryBookingSnapshot,
  offeringPolicySelection,
  offeringPublicationDecision,
} from '@/lib/acquisition/category-offering-policy';

const {
  mockRequireAuth,
  mockResolveOwned,
  mockPermissions,
  mockMembership,
  mockPolicy,
  mockOfferingCreate,
  mockCategoryFind,
  mockCategoryFindFirst,
  mockSession,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockResolveOwned: vi.fn(),
  mockPermissions: vi.fn(),
  mockMembership: vi.fn(),
  mockPolicy: vi.fn(),
  mockOfferingCreate: vi.fn(),
  mockCategoryFind: vi.fn(),
  mockCategoryFindFirst: vi.fn(),
  mockSession: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/business/provider-ownership', () => ({
  resolveOwnedProvider: mockResolveOwned,
  ProviderOwnershipError: class ProviderOwnershipError extends Error {},
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    teachingPermission: { findMany: mockPermissions, create: vi.fn() },
    membership: { findFirst: mockMembership },
    cancellationPolicy: { findUnique: mockPolicy },
    offering: { findFirst: vi.fn().mockResolvedValue(null), create: mockOfferingCreate },
    categoryOffering: {
      findMany: mockCategoryFind,
      findFirst: mockCategoryFindFirst,
      create: vi.fn(),
    },
  },
}));

import { GET as categoryLanding } from '@/app/api/categories/[category]/route';
import { POST as publishOffering } from '@/app/api/instructors/me/offerings/route';
import { categorySnapshotForBooking } from '@/lib/acquisition/category-offering-store';

const bPermission = {
  id: 'perm_b',
  category: 'B',
  legalEntityRef: '556000-0000',
  locationRef: 'Sjöbo',
  status: 'CURRENT',
};

beforeEach(() => {
  delete process.env.CATEGORY_OFFERINGS;
  delete process.env.SCHOOL_MEDIATED_INSTRUCTORS;
  mockRequireAuth.mockReset();
  mockResolveOwned.mockReset();
  mockPermissions.mockReset();
  mockMembership.mockReset();
  mockPolicy.mockReset();
  mockOfferingCreate.mockReset();
  mockCategoryFind.mockReset();
  mockCategoryFindFirst.mockReset();
  mockSession.mockReset();
  mockRequireAuth.mockResolvedValue({ id: 'user_1' });
  mockResolveOwned.mockResolvedValue({
    id: 'school_1',
    providerRole: 'SCHOOL',
    city: 'Sjöbo',
  });
  mockMembership.mockResolvedValue({ organization: { organizationNumber: '556000-0000' } });
});

describe('category offerings', () => {
  it('SC-22 refuses A/C/D when the stored permission is B at the same entity and location', () => {
    const base = {
      enforced: true,
      permissions: [bPermission],
      listingLegalEntity: '556000-0000',
      listingLocation: 'Sjöbo',
    };
    expect(offeringPublicationDecision({ ...base, offeringCategory: 'A' }).code).toBe(
      'category_not_permitted',
    );
    expect(offeringPublicationDecision({ ...base, offeringCategory: 'C' }).code).toBe(
      'category_not_permitted',
    );
    expect(offeringPublicationDecision({ ...base, offeringCategory: 'B' }).allowed).toBe(true);
    expect(
      offeringPublicationDecision({
        ...base,
        offeringCategory: 'C',
        permissions: [{ ...bPermission, category: 'C', locationRef: 'Malmö' }],
      }).code,
    ).toBe('category_not_permitted');
  });

  it('snapshots an approved policy version and refuses a draft', () => {
    expect(
      offeringPolicySelection({
        listingId: 'school_1',
        policy: {
          id: 'pol_1',
          listingId: 'school_1',
          version: 3,
          approvedAt: null,
          state: 'draft',
        },
      }).ok,
    ).toBe(false);
    const selected = offeringPolicySelection({
      listingId: 'school_1',
      policy: {
        id: 'pol_1',
        listingId: 'school_1',
        version: 3,
        approvedAt: '2026-10-01T00:00:00.000Z',
        state: 'active',
      },
    });
    expect(selected).toEqual({ ok: true, snapshot: { policyId: 'pol_1', version: 3 } });
    expect(
      categoryBookingSnapshot({
        offeringId: 'off_1',
        category: 'C',
        policyId: 'pol_1',
        policyVersion: 3,
      }),
    ).toEqual({
      offeringId: 'off_1',
      category: 'C',
      policyId: 'pol_1',
      policyVersion: 3,
    });
  });

  it('does not read a category offering for a booking while the flag is off', async () => {
    const result = await categorySnapshotForBooking('off_1', 'school_1');
    expect(result).toEqual({ ok: true, snapshot: null });
    expect(mockCategoryFindFirst).not.toHaveBeenCalled();
  });

  it('hides the category landing while the flag is off', async () => {
    const res = await categoryLanding(new Request('http://localhost/api/categories/C'), {
      params: Promise.resolve({ category: 'C' }),
    });
    expect(res.status).toBe(404);
    expect(mockCategoryFind).not.toHaveBeenCalled();
  });

  it('refuses an A offering when the school only holds B', async () => {
    process.env.CATEGORY_OFFERINGS = '1';
    mockPermissions.mockResolvedValue([bPermission]);
    const res = await publishOffering(
      new Request('http://localhost/api/instructors/me/offerings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'LEKTION',
          name: 'Motorcycle',
          priceSek: 900,
          teachingCategory: 'A',
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'category_not_permitted' } });
    expect(mockOfferingCreate).not.toHaveBeenCalled();
    delete process.env.CATEGORY_OFFERINGS;
  });
});
