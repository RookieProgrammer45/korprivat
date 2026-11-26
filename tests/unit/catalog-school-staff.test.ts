import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockLicenseFindMany, mockMembershipFindMany } = vi.hoisted(() => ({
  mockLicenseFindMany: vi.fn(),
  mockMembershipFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructorLicense: { findMany: mockLicenseFindMany },
    membership: { findMany: mockMembershipFindMany },
  },
}));

import { buildVerifiedProviderActivationWhere } from '@/lib/business/provider-activation';

describe('catalogue eligibility for school-invited instructors', () => {
  beforeEach(() => {
    mockLicenseFindMany.mockReset();
    mockMembershipFindMany.mockReset();
  });

  it('includes active staff of a licensed school owner without a personal licence', async () => {
    mockLicenseFindMany.mockResolvedValueOnce([{ userId: 'owner_1' }]);
    mockMembershipFindMany
      .mockResolvedValueOnce([{ organizationId: 'org_1' }])
      .mockResolvedValueOnce([{ userId: 'owner_1' }, { userId: 'staff_1' }]);

    const where = await buildVerifiedProviderActivationWhere();
    const clauses = where.AND as Array<{ userId?: { in: string[] } }>;
    const listed = clauses.find((clause) => clause.userId)?.userId?.in ?? [];
    expect(listed).toEqual(expect.arrayContaining(['owner_1', 'staff_1']));
  });

  it('does not list staff after the school has no licensed owner', async () => {
    mockLicenseFindMany.mockResolvedValueOnce([]);
    const where = await buildVerifiedProviderActivationWhere();
    expect(where.AND).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: { in: [] } })]),
    );
    expect(mockMembershipFindMany).not.toHaveBeenCalled();
  });
});
