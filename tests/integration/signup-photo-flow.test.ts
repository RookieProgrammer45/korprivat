// The repository Vitest config intentionally excludes integration/**; run this
// file explicitly with `npx vitest run --include tests/integration/signup-photo-flow.test.ts`.
// @vitest-environment node

import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn() },
  photoVerification: { findUnique: vi.fn() },
  instructorLicense: { findUnique: vi.fn() },
  clickwrapAcceptance: { findUnique: vi.fn() },
  requireAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@/lib/email/onboarding', () => ({ completeSignupHandshake: vi.fn() }));

import { beforeEach, describe, expect, it } from 'vitest';
import { POST as completePOST } from '@/app/api/signup/complete/route';

const user = {
  id: 'user_flow',
  email: 'flow@example.test',
  name: 'Flow User',
  role: 'user' as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(user);
  mocks.user.findUnique.mockResolvedValue({ image: 'https://cdn.test/confirmed.png' });
  mocks.photoVerification.findUnique.mockResolvedValue({
    status: 'CONFIRMED',
    stagedUrl: 'https://cdn.test/confirmed.png',
    confirmedAt: new Date(),
  });
  mocks.instructorLicense.findUnique.mockResolvedValue(null);
  mocks.clickwrapAcceptance.findUnique.mockResolvedValue(null);
});

function request(): Request {
  return new Request('http://localhost/api/signup/complete', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
}

describe('signup photo gate across marketplace roles', () => {
  it('lets STUDENT complete without a photo (add later on /profile)', async () => {
    mocks.userProfile.findUnique.mockResolvedValue({ role: 'STUDENT' });
    mocks.user.findUnique.mockResolvedValue({ image: null });
    mocks.photoVerification.findUnique.mockResolvedValue(null);
    const { completeSignupHandshake } = await import('@/lib/email/onboarding');
    vi.mocked(completeSignupHandshake).mockResolvedValue({
      dashboardPath: '/dashboard/student',
      welcomeSent: true,
    });
    const response = await completePOST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      next: '/onboarding/learner/verify',
      to: '/onboarding/learner/verify',
    });
  });

  it.each([
    ['INSTRUCTOR', 'license_required'],
    ['HANDLEDARE', 'clickwrap_required'],
  ])('blocks %s until its persisted prerequisite is complete', async (role, expected) => {
    mocks.userProfile.findUnique.mockResolvedValue({ role });
    const response = await completePOST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      errors: {
        [role === 'INSTRUCTOR' ? 'license' : 'clickwrap']: expected,
      },
    });
  });

  it('blocks INSTRUCTOR without a confirmed photo before license', async () => {
    mocks.userProfile.findUnique.mockResolvedValue({ role: 'INSTRUCTOR' });
    mocks.user.findUnique.mockResolvedValue({ image: null });
    mocks.photoVerification.findUnique.mockResolvedValue(null);
    const response = await completePOST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      errors: { photo: 'photo_confirmation_required' },
    });
  });
});
