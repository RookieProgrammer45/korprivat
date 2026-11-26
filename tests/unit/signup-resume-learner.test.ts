import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserProfileFindUnique,
  mockListMemberships,
  mockInstructorLicense,
  mockClickwrap,
  mockConfirmedPhoto,
} = vi.hoisted(() => ({
  mockUserProfileFindUnique: vi.fn(),
  mockListMemberships: vi.fn(),
  mockInstructorLicense: vi.fn(),
  mockClickwrap: vi.fn(),
  mockConfirmedPhoto: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mockUserProfileFindUnique, update: vi.fn() },
    instructorLicense: { findUnique: mockInstructorLicense },
    clickwrapAcceptance: { findUnique: mockClickwrap },
    user: { findUnique: vi.fn() },
  },
}));

vi.mock('@/lib/orgs/service', () => ({
  OrgAlreadyExistsError: class OrgAlreadyExistsError extends Error {},
  listMembershipsForUser: mockListMemberships,
  createOrganization: vi.fn(),
}));

vi.mock('@/lib/email/onboarding', () => ({
  completeSignupHandshake: vi.fn(),
}));

vi.mock('@/lib/business/photo-verification', () => ({
  confirmedPhotoUrl: mockConfirmedPhoto,
}));

vi.mock('@/lib/require-auth', () => ({
  getSessionUser: vi.fn(async () => null),
}));

vi.mock('@/lib/verification/handledare-enrollment', () => ({
  loadActiveHandledareEnrollment: vi.fn(async () => null),
}));

import { resolveSignedInSignup } from '@/lib/signup-resume';

const learnerRow = {
  role: 'STUDENT',
  signupPath: 'LEARNER',
  dateOfBirth: null,
  dateOfBirthVerified: null,
  verificationState: 'SIGNED_UP',
  diditAttempts: 0,
  diditLastDecision: null,
  diditSessionId: null,
  schoolName: null,
  organizationNumber: null,
  city: null,
};

describe('resolveSignedInSignup for learners', () => {
  beforeEach(() => {
    mockUserProfileFindUnique.mockReset();
    mockListMemberships.mockReset();
    mockInstructorLicense.mockReset();
    mockClickwrap.mockReset();
    mockConfirmedPhoto.mockReset();
    mockListMemberships.mockResolvedValue([]);
    mockUserProfileFindUnique.mockResolvedValue(learnerRow);
  });

  it('sends a verified Google learner to the dashboard instead of the profile wizard', async () => {
    const disposition = await resolveSignedInSignup({
      id: 'user_google',
      email: 'samuelstronga@gmail.com',
      name: 'Stronga',
      emailVerified: true,
    });
    expect(disposition).toEqual({ kind: 'redirect', to: '/dashboard/student' });
  });

  it('keeps unverified email on the signup wizard', async () => {
    const disposition = await resolveSignedInSignup({
      id: 'user_google',
      email: 'samuelstronga@gmail.com',
      name: 'Stronga',
      emailVerified: false,
    });
    expect(disposition).toEqual({ kind: 'continue_wizard' });
  });
});
