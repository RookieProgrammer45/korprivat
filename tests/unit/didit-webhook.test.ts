import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDiditWebhookCreate,
  mockUserProfileFindUnique,
  mockUserProfileUpdate,
  mockVerificationEventCreate,
  mockTransaction,
} = vi.hoisted(() => ({
  mockDiditWebhookCreate: vi.fn(),
  mockUserProfileFindUnique: vi.fn(),
  mockUserProfileUpdate: vi.fn(),
  mockVerificationEventCreate: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/db', () => ({
  prisma: {
    diditWebhookEvent: { create: mockDiditWebhookCreate },
    userProfile: {
      findUnique: mockUserProfileFindUnique,
      update: mockUserProfileUpdate,
    },
    verificationEvent: { create: mockVerificationEventCreate },
    $transaction: mockTransaction,
  },
}));

import { POST } from '@/app/api/webhooks/didit/route';

const WEBHOOK_SECRET = 'test-didit-webhook-secret';

function dobYearsAgo(years: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCMonth(0, 15);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function sign(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');
}

function fixturePayload(overrides: {
  sessionId?: string;
  vendorData?: string;
  status?: string;
  dateOfBirth?: string | null;
  reason?: string | null;
}): string {
  const sessionId = overrides.sessionId ?? 'sess_test_1';
  const vendorData = overrides.vendorData ?? 'user_learner_1';
  const status = overrides.status ?? 'approved';
  const dateOfBirth =
    overrides.dateOfBirth === undefined ? dobYearsAgo(25) : overrides.dateOfBirth;
  return JSON.stringify({
    session: {
      id: sessionId,
      session_id: sessionId,
      vendor_data: vendorData,
      status,
      document: {
        date_of_birth: dateOfBirth,
        first_name: 'Test',
        last_name: 'Learner',
        document_type: 'passport',
        document_number: 'P123',
        nationality: 'SWE',
      },
      decision: {
        date_of_birth: dateOfBirth,
        reason: overrides.reason ?? null,
        liveness_passed: true,
      },
      liveness: { passed: true },
    },
  });
}

function signedRequest(rawBody: string, signature?: string | null): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (signature !== null) {
    headers.set('x-didit-signature', signature ?? sign(rawBody));
  }
  return new Request('http://localhost/api/webhooks/didit', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function baseProfile(
  overrides: Partial<{
    userId: string;
    dateOfBirth: Date | null;
    dateOfBirthVerified: Date | null;
    verificationState: string;
    diditAttempts: number;
  }> = {},
) {
  return {
    userId: 'user_learner_1',
    dateOfBirth: new Date(dobYearsAgo(25)),
    dateOfBirthVerified: null,
    verificationState: 'DIDIT_PENDING',
    diditAttempts: 0,
    ...overrides,
  };
}

describe('POST /api/webhooks/didit', () => {
  beforeEach(() => {
    process.env.DIDIT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    mockDiditWebhookCreate.mockReset();
    mockUserProfileFindUnique.mockReset();
    mockUserProfileUpdate.mockReset();
    mockVerificationEventCreate.mockReset();
    mockTransaction.mockReset();
    mockDiditWebhookCreate.mockResolvedValue({ id: 'evt_1' });
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

  it('returns 401 when signature is invalid', async () => {
    const body = fixturePayload({});
    const res = await POST(signedRequest(body, 'deadbeef'));
    expect(res.status).toBe(401);
    expect(mockDiditWebhookCreate).not.toHaveBeenCalled();
  });

  it('returns 401 when signature header is missing', async () => {
    const body = fixturePayload({});
    const res = await POST(signedRequest(body, null));
    expect(res.status).toBe(401);
  });

  it('approved + age 25 → ACTIVE and sets dateOfBirthVerified', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile());
    const body = fixturePayload({ status: 'approved', dateOfBirth: dobYearsAgo(25) });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'ACTIVE' });

    expect(mockUserProfileUpdate).toHaveBeenCalledOnce();
    const update = mockUserProfileUpdate.mock.calls[0][0] as {
      data: { verificationState: string; dateOfBirthVerified: Date };
    };
    expect(update.data.verificationState).toBe('ACTIVE');
    expect(update.data.dateOfBirthVerified).toBeInstanceOf(Date);
  });

  it('approved + age 16 → HANDLEDARE_PENDING', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({ dateOfBirth: new Date(dobYearsAgo(16)) }),
    );
    const body = fixturePayload({ status: 'approved', dateOfBirth: dobYearsAgo(16) });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'HANDLEDARE_PENDING' });
  });

  it('approved + age 15 → BLOCKED_UNDERAGE', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({ dateOfBirth: new Date(dobYearsAgo(15)) }),
    );
    const body = fixturePayload({ status: 'approved', dateOfBirth: dobYearsAgo(15) });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'BLOCKED_UNDERAGE' });
  });

  it('declined → DIDIT_FAILED and increments attempts', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile({ diditAttempts: 1 }));
    const body = fixturePayload({
      status: 'declined',
      dateOfBirth: null,
      reason: 'document_blurry',
    });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'DIDIT_FAILED' });

    const update = mockUserProfileUpdate.mock.calls[0][0] as {
      data: { diditAttempts: number; verificationState: string };
    };
    expect(update.data.diditAttempts).toBe(2);
    expect(update.data.verificationState).toBe('DIDIT_FAILED');
  });

  it('replay same (sessionId, decision) → 200 { duplicate: true }, no second write', async () => {
    mockDiditWebhookCreate.mockRejectedValueOnce({ code: 'P2002' });
    const body = fixturePayload({});
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ duplicate: true });
    expect(mockUserProfileFindUnique).not.toHaveBeenCalled();
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('unknown vendorData → 200 { ignored: true }, no user write', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(null);
    const body = fixturePayload({ vendorData: 'missing_user' });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ignored: true });
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('out-of-order in_review after approved → state stays ACTIVE', async () => {
    const verified = new Date(dobYearsAgo(25));
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({
        verificationState: 'ACTIVE',
        dateOfBirthVerified: verified,
        diditAttempts: 0,
      }),
    );
    const body = fixturePayload({
      sessionId: 'sess_late_review',
      status: 'in_review',
      dateOfBirth: null,
    });
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'ACTIVE' });

    const update = mockUserProfileUpdate.mock.calls[0][0] as {
      data: { verificationState: string; dateOfBirthVerified?: Date };
    };
    expect(update.data.verificationState).toBe('ACTIVE');
    expect(update.data.dateOfBirthVerified).toBeUndefined();
  });
});
