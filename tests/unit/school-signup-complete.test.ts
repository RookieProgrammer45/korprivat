import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserProfileFindUnique,
  mockUserProfileUpdate,
  mockListMemberships,
  mockCreateOrganization,
  mockCompleteHandshake,
} = vi.hoisted(() => ({
  mockUserProfileFindUnique: vi.fn(),
  mockUserProfileUpdate: vi.fn(),
  mockListMemberships: vi.fn(),
  mockCreateOrganization: vi.fn(),
  mockCompleteHandshake: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mockUserProfileFindUnique, update: mockUserProfileUpdate },
    instructorLicense: { findUnique: vi.fn() },
    clickwrapAcceptance: { findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/orgs/service', () => {
  class OrgAlreadyExistsError extends Error {
    readonly code = 'ORG_EXISTS' as const;
    constructor() {
      super('Organization already exists');
      this.name = 'OrgAlreadyExistsError';
    }
  }
  return {
    OrgAlreadyExistsError,
    listMembershipsForUser: mockListMemberships,
    createOrganization: mockCreateOrganization,
  };
});

vi.mock('@/lib/email/onboarding', () => ({
  completeSignupHandshake: mockCompleteHandshake,
}));

vi.mock('@/lib/business/photo-verification', () => ({
  confirmedPhotoUrl: vi.fn(async () => null),
}));

vi.mock('@/lib/require-auth', () => ({
  getSessionUser: vi.fn(async () => null),
}));

import { OrgAlreadyExistsError } from '@/lib/orgs/service';
import { ensureSchoolSignupComplete } from '@/lib/signup-resume';

describe('ensureSchoolSignupComplete', () => {
  beforeEach(() => {
    mockUserProfileFindUnique.mockReset();
    mockUserProfileUpdate.mockReset();
    mockUserProfileUpdate.mockResolvedValue({});
    mockListMemberships.mockReset();
    mockCreateOrganization.mockReset();
    mockCompleteHandshake.mockReset();
    mockCompleteHandshake.mockResolvedValue({ dashboardPath: '/dashboard/student' });
  });

  it('returns not_school when signupPath is not SCHOOL', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      signupPath: 'LEARNER',
      schoolName: null,
      organizationNumber: null,
      city: null,
    });
    const result = await ensureSchoolSignupComplete({
      id: 'u1',
      email: 'a@example.com',
      name: 'A',
    });
    expect(result).toEqual({ ok: false, reason: 'not_school' });
    expect(mockCreateOrganization).not.toHaveBeenCalled();
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
  });

  it('creates org when SCHOOL path has no membership', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      signupPath: 'SCHOOL',
      schoolName: 'Test Skola',
      organizationNumber: '5561234567',
      city: 'Stockholm',
    });
    mockListMemberships.mockResolvedValueOnce([]);
    mockCreateOrganization.mockResolvedValueOnce({ organization: { id: 'org1' }, membership: {} });

    const result = await ensureSchoolSignupComplete({
      id: 'u1',
      email: 'school@example.com',
      name: 'Owner',
    });

    expect(result).toEqual({ ok: true, next: '/dashboard/school' });
    expect(mockUserProfileUpdate).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      data: { role: 'SCHOOL' },
    });
    expect(mockCreateOrganization).toHaveBeenCalledOnce();
    expect(mockCompleteHandshake).toHaveBeenCalledWith(
      expect.objectContaining({ requestedRole: 'SCHOOL' }),
    );
  });

  it('is idempotent when OWNER membership already exists', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      signupPath: 'SCHOOL',
      schoolName: 'Test Skola',
      organizationNumber: '5561234567',
      city: 'Stockholm',
    });
    mockListMemberships.mockResolvedValueOnce([{ role: 'OWNER', status: 'ACTIVE' }]);

    const result = await ensureSchoolSignupComplete({
      id: 'u1',
      email: 'school@example.com',
      name: 'Owner',
    });

    expect(result).toEqual({ ok: true, next: '/dashboard/school' });
    expect(mockCreateOrganization).not.toHaveBeenCalled();
  });

  it('treats OrgAlreadyExists as success when membership appears after race', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      signupPath: 'SCHOOL',
      schoolName: 'Test Skola',
      organizationNumber: '5561234567',
      city: 'Stockholm',
    });
    mockListMemberships
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ role: 'OWNER', status: 'ACTIVE' }]);
    mockCreateOrganization.mockRejectedValueOnce(new OrgAlreadyExistsError());

    const result = await ensureSchoolSignupComplete({
      id: 'u1',
      email: 'school@example.com',
      name: 'Owner',
    });

    expect(result).toEqual({ ok: true, next: '/dashboard/school' });
  });
});
