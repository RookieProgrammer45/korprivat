import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  shortenFloats,
  sortKeys,
  verifySignatureSimple,
  verifySignatureV2,
} from '@/lib/verification/didit';

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
    handledareEnrollment: { findFirst: vi.fn(async () => null) },
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

function signRaw(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody, 'utf8').digest('hex');
}

function signV2(jsonBody: unknown): string {
  const canonical = JSON.stringify(sortKeys(shortenFloats(jsonBody)));
  return createHmac('sha256', WEBHOOK_SECRET).update(canonical, 'utf8').digest('hex');
}

function signSimple(jsonBody: {
  timestamp?: number | string;
  session_id?: string;
  status?: string;
  webhook_type?: string;
}): string {
  const canonical = [
    jsonBody.timestamp ?? '',
    jsonBody.session_id ?? '',
    jsonBody.status ?? '',
    jsonBody.webhook_type ?? '',
  ].join(':');
  return createHmac('sha256', WEBHOOK_SECRET).update(canonical, 'utf8').digest('hex');
}

function fixturePayload(overrides: {
  eventId?: string;
  sessionId?: string;
  vendorData?: string;
  status?: string;
  webhookType?: string;
  dateOfBirth?: string | null;
  reason?: string | null;
  timestamp?: number;
}): { body: Record<string, unknown>; raw: string } {
  const timestamp = overrides.timestamp ?? Math.floor(Date.now() / 1000);
  const sessionId = overrides.sessionId ?? 'sess_test_1';
  const vendorData = overrides.vendorData ?? 'user_learner_1';
  const status = overrides.status ?? 'Approved';
  const webhookType = overrides.webhookType ?? 'status.updated';
  const dateOfBirth =
    overrides.dateOfBirth === undefined ? dobYearsAgo(25) : overrides.dateOfBirth;

  const body: Record<string, unknown> = {
    event_id: overrides.eventId ?? 'evt_test_1',
    session_id: sessionId,
    status,
    webhook_type: webhookType,
    created_at: timestamp,
    timestamp,
    vendor_data: vendorData,
    metadata: {},
  };

  if (dateOfBirth !== null || overrides.reason) {
    body.decision = {
      id_verifications: dateOfBirth
        ? [
            {
              date_of_birth: dateOfBirth,
              first_name: 'Test',
              last_name: 'Learner',
              document_type: 'passport',
              document_number: 'P123',
              nationality: 'SWE',
              warnings: overrides.reason
                ? [{ short_description: overrides.reason, risk: 'HIGH' }]
                : [],
            },
          ]
        : [],
      liveness_checks: [{ status: 'Approved' }],
      reason: overrides.reason ?? null,
    };
  }

  return { body, raw: JSON.stringify(body) };
}

function signedRequest(
  rawBody: string,
  opts: {
    signatureV2?: string | null;
    signatureRaw?: string | null;
    signatureSimple?: string | null;
    timestamp?: string | null;
    jsonBody?: unknown;
  } = {},
): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  const ts =
    opts.timestamp === null
      ? null
      : (opts.timestamp ?? String(Math.floor(Date.now() / 1000)));
  if (ts) headers.set('x-timestamp', ts);

  if (opts.signatureV2 !== null && opts.signatureV2 !== undefined) {
    headers.set('x-signature-v2', opts.signatureV2);
  } else if (opts.signatureV2 === undefined && opts.jsonBody !== undefined) {
    headers.set('x-signature-v2', signV2(opts.jsonBody));
  }

  if (opts.signatureRaw) {
    headers.set('x-signature', opts.signatureRaw);
  }
  if (opts.signatureSimple) {
    headers.set('x-signature-simple', opts.signatureSimple);
  }

  return new Request('http://localhost/api/webhooks/didit', {
    method: 'POST',
    headers,
    body: rawBody,
  });
}

function requestWithV2(payload: { body: Record<string, unknown>; raw: string }): Request {
  return signedRequest(payload.raw, { jsonBody: payload.body });
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

describe('Didit signature helpers', () => {
  beforeEach(() => {
    process.env.DIDIT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.DIDIT_WORKFLOW_ID = '67d67971-0946-4711-a84e-80388353f03a';
  });

  it('verifySignatureV2 accepts canonical sorted JSON', () => {
    const payload = fixturePayload({});
    const sig = signV2(payload.body);
    const ts = String(payload.body.timestamp);
    expect(verifySignatureV2(payload.body, sig, ts, WEBHOOK_SECRET)).toBe(true);
  });

  it('verifySignatureSimple accepts envelope fields', () => {
    const payload = fixturePayload({});
    const sig = signSimple(payload.body as {
      timestamp: number;
      session_id: string;
      status: string;
      webhook_type: string;
    });
    const ts = String(payload.body.timestamp);
    expect(
      verifySignatureSimple(
        payload.body as Record<string, unknown>,
        sig,
        ts,
        WEBHOOK_SECRET,
      ),
    ).toBe(true);
  });

  it('rejects stale timestamps (>300s)', () => {
    const payload = fixturePayload({ timestamp: Math.floor(Date.now() / 1000) - 400 });
    const sig = signV2(payload.body);
    expect(
      verifySignatureV2(
        payload.body,
        sig,
        String(payload.body.timestamp),
        WEBHOOK_SECRET,
      ),
    ).toBe(false);
  });
});

describe('POST /api/webhooks/didit', () => {
  beforeEach(() => {
    process.env.DIDIT_WEBHOOK_SECRET = WEBHOOK_SECRET;
    process.env.DIDIT_WORKFLOW_ID = '67d67971-0946-4711-a84e-80388353f03a';
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
    const payload = fixturePayload({});
    const res = await POST(
      signedRequest(payload.raw, {
        signatureV2: 'deadbeef',
        timestamp: String(payload.body.timestamp),
      }),
    );
    expect(res.status).toBe(401);
    expect(mockDiditWebhookCreate).not.toHaveBeenCalled();
  });

  it('returns 401 when signature and timestamp headers are missing', async () => {
    const payload = fixturePayload({});
    const res = await POST(
      signedRequest(payload.raw, {
        signatureV2: null,
        timestamp: null,
      }),
    );
    expect(res.status).toBe(401);
  });

  it('accepts X-Signature (raw body) when V2 is absent', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile());
    const payload = fixturePayload({ status: 'Approved', dateOfBirth: dobYearsAgo(25) });
    const res = await POST(
      signedRequest(payload.raw, {
        signatureV2: null,
        signatureRaw: signRaw(payload.raw),
        timestamp: String(payload.body.timestamp),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'ACTIVE' });
  });

  it('Approved + age 25 → ACTIVE and sets dateOfBirthVerified', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile());
    const payload = fixturePayload({ status: 'Approved', dateOfBirth: dobYearsAgo(25) });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'ACTIVE' });

    expect(mockUserProfileUpdate).toHaveBeenCalledOnce();
    const update = mockUserProfileUpdate.mock.calls[0]![0] as {
      data: { verificationState: string; dateOfBirthVerified: Date };
    };
    expect(update.data.verificationState).toBe('ACTIVE');
    expect(update.data.dateOfBirthVerified).toBeInstanceOf(Date);
  });

  it('Approved + age 16 → HANDLEDARE_PENDING', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({ dateOfBirth: new Date(dobYearsAgo(16)) }),
    );
    const payload = fixturePayload({ status: 'Approved', dateOfBirth: dobYearsAgo(16) });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'HANDLEDARE_PENDING' });
  });

  it('Approved + age 15 → BLOCKED_UNDERAGE', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({ dateOfBirth: new Date(dobYearsAgo(15)) }),
    );
    const payload = fixturePayload({ status: 'Approved', dateOfBirth: dobYearsAgo(15) });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'BLOCKED_UNDERAGE' });
  });

  it('Declined → DIDIT_FAILED and increments attempts', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(baseProfile({ diditAttempts: 1 }));
    const payload = fixturePayload({
      status: 'Declined',
      dateOfBirth: null,
      reason: 'document_blurry',
    });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'DIDIT_FAILED' });

    const update = mockUserProfileUpdate.mock.calls[0]![0] as {
      data: { diditAttempts: number; verificationState: string };
    };
    expect(update.data.diditAttempts).toBe(2);
    expect(update.data.verificationState).toBe('DIDIT_FAILED');
  });

  it('replay same event_id → 200 { duplicate: true }, no second write', async () => {
    mockDiditWebhookCreate.mockRejectedValueOnce({ code: 'P2002' });
    const payload = fixturePayload({});
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ duplicate: true });
    expect(mockUserProfileFindUnique).not.toHaveBeenCalled();
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('unknown vendorData → 200 { ignored: true }, no user write', async () => {
    mockUserProfileFindUnique.mockResolvedValueOnce(null);
    const payload = fixturePayload({ vendorData: 'missing_user' });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ignored: true });
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('out-of-order In Review after approved → state stays ACTIVE', async () => {
    const verified = new Date(dobYearsAgo(25));
    mockUserProfileFindUnique.mockResolvedValueOnce(
      baseProfile({
        verificationState: 'ACTIVE',
        dateOfBirthVerified: verified,
        diditAttempts: 0,
      }),
    );
    const payload = fixturePayload({
      eventId: 'evt_late_review',
      sessionId: 'sess_late_review',
      status: 'In Review',
      dateOfBirth: null,
    });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, state: 'ACTIVE' });

    const update = mockUserProfileUpdate.mock.calls[0]![0] as {
      data: { verificationState: string; dateOfBirthVerified?: Date };
    };
    expect(update.data.verificationState).toBe('ACTIVE');
    expect(update.data.dateOfBirthVerified).toBeUndefined();
  });

  it('acks non-session webhook_type without profile writes', async () => {
    const payload = fixturePayload({
      webhookType: 'transaction.created',
      status: 'Approved',
    });
    const res = await POST(requestWithV2(payload));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      ignored: true,
      webhook_type: 'transaction.created',
    });
    expect(mockUserProfileFindUnique).not.toHaveBeenCalled();
  });

  it('Approved via X-Signature-Simple alone does not write dateOfBirthVerified', async () => {
    const payload = fixturePayload({ status: 'Approved', dateOfBirth: dobYearsAgo(25) });
    const res = await POST(
      signedRequest(payload.raw, {
        signatureV2: null,
        signatureSimple: signSimple(payload.body as {
          timestamp: number;
          session_id: string;
          status: string;
          webhook_type: string;
        }),
        timestamp: String(payload.body.timestamp),
      }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      deferred: true,
      reason: 'decision_untrusted',
    });
    expect(mockUserProfileUpdate).not.toHaveBeenCalled();
  });
});
