import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  requireAuth: vi.fn(),
  userProfileFindUnique: vi.fn(),
  userProfileUpsert: vi.fn(),
  photoVerificationFindUnique: vi.fn(),
  photoVerificationUpsert: vi.fn(),
  loadActiveHandledareEnrollment: vi.fn(),
  redirect: vi.fn(),
  sendEmail: vi.fn(),
  resetPasswordEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/require-auth', () => ({
  getSessionUser: mocks.getSessionUser,
  requireAuth: mocks.requireAuth,
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: {
      findUnique: mocks.userProfileFindUnique,
      upsert: mocks.userProfileUpsert,
    },
    photoVerification: {
      findUnique: mocks.photoVerificationFindUnique,
      upsert: mocks.photoVerificationUpsert,
    },
  },
}));
vi.mock('@/lib/verification/handledare-enrollment', () => ({
  loadActiveHandledareEnrollment: mocks.loadActiveHandledareEnrollment,
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }));
vi.mock('@/lib/email/reset-password', () => ({
  resetPasswordEmail: mocks.resetPasswordEmail,
}));
vi.mock('@/lib/site', () => ({ siteUrl: 'https://app.example.test' }));

import { POST as signupStartPOST } from '@/app/api/signup/start/route';
import { authConfig } from '@/lib/auth-config';
import {
  forgotPasswordHrefWithNext,
  loginHrefWithNext,
  recoveryNextFromCallbackURL,
  resetPasswordHrefWithNext,
  sanitizeNext,
} from '@/lib/auth-next';
import { redirectLearnerAwayFromSignup } from '@/lib/signup-resume';

const USER = { id: 'user_account_reliability', email: 'learner@example.test' };
const CLAIMED_DOB = new Date('2000-01-15T00:00:00.000Z');

function learnerProfile(verificationState: string) {
  return {
    role: 'STUDENT',
    signupPath: 'LEARNER',
    dateOfBirth: CLAIMED_DOB,
    dateOfBirthVerified: null,
    verificationState,
    diditAttempts: 0,
    diditLastDecision: null,
    diditSessionId: null,
  };
}

function signupStartRequest(dateOfBirth = '2000-01-15'): Request {
  return new Request('http://localhost/api/signup/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ path: 'LEARNER', dateOfBirth }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue(USER);
  mocks.getSessionUser.mockResolvedValue(null);
  mocks.userProfileFindUnique.mockResolvedValue(null);
  mocks.userProfileUpsert.mockResolvedValue({});
  mocks.photoVerificationFindUnique.mockResolvedValue(null);
  mocks.photoVerificationUpsert.mockResolvedValue({});
  mocks.loadActiveHandledareEnrollment.mockResolvedValue(null);
  mocks.sendEmail.mockResolvedValue(undefined);
  mocks.resetPasswordEmail.mockImplementation(({ resetUrl }: { resetUrl: string }) => ({
    subject: 'Reset password',
    html: resetUrl,
    text: resetUrl,
  }));
});

describe('account recovery return-path reliability', () => {
  it('preserves a validated booking path through the recovery URL chain', () => {
    const next = '/dashboard/student/bookings?instructor=omar';
    const forgotHref = forgotPasswordHrefWithNext(next);
    const resetHref = resetPasswordHrefWithNext(next);

    expect(forgotHref).toBe(
      '/forgot-password?next=%2Fdashboard%2Fstudent%2Fbookings%3Finstructor%3Domar',
    );
    expect(resetHref).toBe(
      '/reset-password?next=%2Fdashboard%2Fstudent%2Fbookings%3Finstructor%3Domar',
    );
    expect(
      recoveryNextFromCallbackURL(
        `https://app.example.test${resetHref}`,
        'https://app.example.test',
      ),
    ).toBe(next);
    expect(loginHrefWithNext(next)).toBe(
      '/login?next=%2Fdashboard%2Fstudent%2Fbookings%3Finstructor%3Domar',
    );
  });

  it('rejects external, encoded protocol-relative, and wrong-route callback targets', () => {
    expect(sanitizeNext('//evil.example')).toBeUndefined();
    expect(sanitizeNext('/\\evil.example')).toBeUndefined();
    expect(sanitizeNext('/%2F%2Fevil.example')).toBeUndefined();
    expect(sanitizeNext('/%5Cevil.example')).toBeUndefined();
    expect(sanitizeNext('/%')).toBeUndefined();
    expect(
      recoveryNextFromCallbackURL(
        'https://evil.example/reset-password?next=%2Fdashboard%2Fstudent%2Fbookings',
        'https://app.example.test',
      ),
    ).toBeUndefined();
    expect(
      recoveryNextFromCallbackURL(
        'https://app.example.test/not-reset-password?next=%2Fdashboard%2Fstudent%2Fbookings',
        'https://app.example.test',
      ),
    ).toBeUndefined();
    expect(
      recoveryNextFromCallbackURL(
        'https://app.example.test/reset-password?next=https%3A%2F%2Fevil.example',
        'https://app.example.test',
      ),
    ).toBeUndefined();
  });

  it('uses the server-validated Better Auth callback in the emailed reset link', async () => {
    const sendResetPassword = authConfig.emailAndPassword?.sendResetPassword;
    if (!sendResetPassword) throw new Error('password reset email callback is unavailable');
    const next = '/dashboard/student/bookings';
    const callbackURL = `https://app.example.test${resetPasswordHrefWithNext(next)}`;
    const url = `https://app.example.test/api/auth/reset-password/reset_token?callbackURL=${encodeURIComponent(callbackURL)}`;

    await sendResetPassword({
      user: { email: USER.email, name: 'Learner' },
      token: 'reset_token',
      url,
    } as Parameters<typeof sendResetPassword>[0]);

    expect(mocks.resetPasswordEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        resetUrl:
          'https://app.example.test/reset-password?next=%2Fdashboard%2Fstudent%2Fbookings&token=reset_token',
      }),
    );
  });
});

describe('optional learner photo resume policy', () => {
  it('allows only the approved photo resume while the learner remains SIGNED_UP', async () => {
    mocks.getSessionUser.mockResolvedValue({ ...USER, emailVerified: true });
    mocks.userProfileFindUnique
      .mockResolvedValueOnce(learnerProfile('SIGNED_UP'))
      .mockResolvedValueOnce({ role: 'STUDENT' });

    await redirectLearnerAwayFromSignup(undefined, true);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it('does not let a photo query bypass an in-progress Didit state', async () => {
    mocks.getSessionUser.mockResolvedValue({ ...USER, emailVerified: true });
    mocks.userProfileFindUnique
      .mockResolvedValueOnce(learnerProfile('DIDIT_PENDING'))
      .mockResolvedValueOnce({ role: 'STUDENT' });
    mocks.redirect.mockImplementation((destination: string) => {
      throw new Error(`redirect:${destination}`);
    });

    await expect(redirectLearnerAwayFromSignup(undefined, true)).rejects.toThrow(
      'redirect:/onboarding/learner/verify',
    );
  });
});

describe('claimed learner DOB lifecycle', () => {
  it.each(['DIDIT_PENDING', 'DIDIT_FAILED', 'ACTIVE'])(
    'returns stable 409 and does not write a changed DOB in %s',
    async (verificationState) => {
      mocks.userProfileFindUnique.mockResolvedValue(learnerProfile(verificationState));

      const response = await signupStartPOST(signupStartRequest('2001-01-15'));

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ errors: { dateOfBirth: 'claimed_dob_locked' } });
      expect(mocks.userProfileUpsert).not.toHaveBeenCalled();
      expect(mocks.photoVerificationUpsert).not.toHaveBeenCalled();
    },
  );

  it('allows the initial SIGNED_UP claim and never includes verified DOB in its write', async () => {
    mocks.userProfileFindUnique.mockResolvedValue(learnerProfile('SIGNED_UP'));

    const response = await signupStartPOST(signupStartRequest());

    expect(response.status).toBe(200);
    const upsert = mocks.userProfileUpsert.mock.calls[0]?.[0] as {
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(upsert.update.dateOfBirth).toEqual(CLAIMED_DOB);
    expect(upsert.create.dateOfBirth).toEqual(CLAIMED_DOB);
    expect(upsert.update).not.toHaveProperty('dateOfBirthVerified');
    expect(upsert.create).not.toHaveProperty('dateOfBirthVerified');
  });
});
