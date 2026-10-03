import { describe, expect, it, vi } from 'vitest';

const { mockUserProfileFindUnique } = vi.hoisted(() => ({
  mockUserProfileFindUnique: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mockUserProfileFindUnique },
    handledareEnrollment: { findFirst: vi.fn(async () => null) },
  },
}));
vi.mock('@/lib/require-auth', () => ({
  getSessionUser: vi.fn(async () => null),
}));

import { resolveLearnerBookingGate } from '@/lib/signup-resume';

function dobYearsAgo(years: number): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - years);
  d.setMonth(0, 15);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe('resolveLearnerBookingGate', () => {
  it('allows ACTIVE verified adults', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      dateOfBirth: dobYearsAgo(30),
      dateOfBirthVerified: dobYearsAgo(30),
      verificationState: 'ACTIVE',
      diditAttempts: 1,
      diditLastDecision: 'approved',
      diditSessionId: 's1',
    });
    await expect(resolveLearnerBookingGate('u1')).resolves.toEqual({
      eligible: true,
      state: 'ACTIVE',
    });
  });

  it('blocks unverified adults and points to Didit', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce({
      dateOfBirth: dobYearsAgo(30),
      dateOfBirthVerified: null,
      verificationState: 'SIGNED_UP',
      diditAttempts: 0,
      diditLastDecision: null,
      diditSessionId: null,
    });
    await expect(resolveLearnerBookingGate('u1')).resolves.toEqual({
      eligible: false,
      state: 'SIGNED_UP',
      redirectTo: '/onboarding/learner/verify',
    });
  });
});
