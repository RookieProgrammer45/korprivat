import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUserProfileFindUnique,
  mockUserProfileUpdate,
  mockVerificationEventCreate,
  mockTransaction,
  mockCreateDiditSession,
} = vi.hoisted(() => ({
  mockUserProfileFindUnique: vi.fn(),
  mockUserProfileUpdate: vi.fn(),
  mockVerificationEventCreate: vi.fn(),
  mockTransaction: vi.fn(),
  mockCreateDiditSession: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ id: 'test-user-id', emailVerified: true })),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: {
      findUnique: mockUserProfileFindUnique,
      update: mockUserProfileUpdate,
    },
    verificationEvent: { create: mockVerificationEventCreate },
    handledareEnrollment: { findFirst: vi.fn(async () => null) },
    $transaction: mockTransaction,
  },
}));

vi.mock('@/lib/verification/didit', async () => {
  const actual = await vi.importActual<typeof import('@/lib/verification/didit')>(
    '@/lib/verification/didit',
  );
  return {
    ...actual,
    createDiditSession: mockCreateDiditSession,
  };
});

vi.mock('@/lib/site', () => ({
  siteUrl: 'https://app.example.com',
}));

import { POST } from '@/app/api/verify/route';

function baseProfile(
  overrides: Partial<{
    role: string;
    dateOfBirth: Date | null;
    dateOfBirthVerified: Date | null;
    verificationState: string;
    diditAttempts: number;
  }> = {},
) {
  return {
    userId: 'user_learner_1',
    role: 'STUDENT',
    dateOfBirth: new Date('2000-01-15T00:00:00.000Z'),
    dateOfBirthVerified: null,
    verificationState: 'SIGNED_UP',
    diditAttempts: 0,
    diditLastDecision: null,
    ...overrides,
  };
}

describe('POST /api/verify', () => {
  beforeEach(() => {
    process.env.DIDIT_WORKFLOW_ID = '67d67971-0946-4711-a84e-80388353f03a';
    mockUserProfileFindUnique.mockReset();
    mockUserProfileUpdate.mockReset();
    mockVerificationEventCreate.mockReset();
    mockTransaction.mockReset();
    mockCreateDiditSession.mockReset();
    mockCreateDiditSession.mockResolvedValue({
      sessionId: 'sess_new_1',
      url: 'https://verify.didit.me/session/sess_new_1',
    });
    mockUserProfileUpdate.mockResolvedValue({});
    mockVerificationEventCreate.mockResolvedValue({ id: 've_1' });
    mockTransaction.mockImplementation(async (callback: unknown) =>
      (callback as (tx: unknown) => Promise<unknown>)({
        userProfile: { update: mockUserProfileUpdate },
        verificationEvent: { create: mockVerificationEventCreate },
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a session and returns url + session_id', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile());
    const res = await POST(new Request('http://localhost/api/verify', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      url: 'https://verify.didit.me/session/sess_new_1',
      session_id: 'sess_new_1',
    });
    expect(mockCreateDiditSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'test-user-id',
        callbackUrl: 'https://app.example.com/onboarding/learner/verify',
      }),
    );
    expect(mockUserProfileUpdate).toHaveBeenCalledOnce();
    const update = mockUserProfileUpdate.mock.calls[0]![0] as {
      data: { verificationState: string; diditSessionId: string };
    };
    expect(update.data.verificationState).toBe('DIDIT_PENDING');
    expect(update.data.diditSessionId).toBe('sess_new_1');
  });

  it('rejects ACTIVE learners with 409', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({
        verificationState: 'ACTIVE',
        dateOfBirthVerified: new Date('2000-01-15'),
      }),
    );
    const res = await POST(new Request('http://localhost/api/verify', { method: 'POST' }));
    expect(res.status).toBe(409);
    expect(mockCreateDiditSession).not.toHaveBeenCalled();
  });

  it('allows retry from DIDIT_FAILED when attempts < max', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({ verificationState: 'DIDIT_FAILED', diditAttempts: 1 }),
    );
    const res = await POST(new Request('http://localhost/api/verify', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(mockCreateDiditSession).toHaveBeenCalledOnce();
  });
});
