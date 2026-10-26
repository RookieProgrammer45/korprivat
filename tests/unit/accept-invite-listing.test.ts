import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockInviteFindUnique, mockTransaction, mockPublish } = vi.hoisted(() => ({
  mockInviteFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockPublish: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    membershipInvite: { findUnique: mockInviteFindUnique },
    $transaction: mockTransaction,
  },
}));
vi.mock('@/lib/discovery/school-staff-listing', () => ({
  publishSchoolStaffListing: mockPublish,
}));

import { acceptInviteByToken } from '@/lib/orgs/service';

describe('acceptInviteByToken catalogue publish', () => {
  beforeEach(() => {
    mockInviteFindUnique.mockReset();
    mockTransaction.mockReset();
    mockPublish.mockReset();
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({
        membership: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn(),
          update: vi.fn(),
        },
        membershipInvite: { update: vi.fn() },
      });
    });
    mockPublish.mockResolvedValue({ created: true, listingId: 'listing_1' });
  });

  it('publishes a school staff listing after the invite is accepted', async () => {
    mockInviteFindUnique.mockResolvedValueOnce({
      id: 'inv_1',
      organizationId: 'org_1',
      email: 'anna@example.test',
      role: 'STAFF',
      acceptedAt: null,
      expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      invitedBy: 'owner_1',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    });

    await acceptInviteByToken('token', 'staff_1', 'anna@example.test');

    expect(mockPublish).toHaveBeenCalledWith({
      organizationId: 'org_1',
      userId: 'staff_1',
    });
  });

  it('retries publish when the invite was already accepted', async () => {
    mockInviteFindUnique.mockResolvedValueOnce({
      id: 'inv_1',
      organizationId: 'org_1',
      email: 'anna@example.test',
      acceptedAt: new Date('2026-10-02T00:00:00.000Z'),
    });

    await acceptInviteByToken('token', 'staff_1', 'anna@example.test');

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockPublish).toHaveBeenCalledWith({
      organizationId: 'org_1',
      userId: 'staff_1',
    });
  });
});
