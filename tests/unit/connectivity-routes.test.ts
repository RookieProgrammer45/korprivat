import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetRateLimits } from '@/lib/connectivity/policy';
import { signPartnerRequest } from '@/lib/connectivity/signing';

const {
  mockCredentialFind,
  mockCredentialMany,
  mockIdempotencyFind,
  mockIdempotencyCreate,
  mockReadinessUpsert,
  mockConnectionUpdate,
  mockSession,
} = vi.hoisted(() => ({
  mockCredentialFind: vi.fn(),
  mockCredentialMany: vi.fn(),
  mockIdempotencyFind: vi.fn(),
  mockIdempotencyCreate: vi.fn(),
  mockReadinessUpsert: vi.fn(async () => ({})),
  mockConnectionUpdate: vi.fn(async () => ({})),
  mockSession: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    partnerCredential: { findUnique: mockCredentialFind, findMany: mockCredentialMany },
    connectivityIdempotency: { findUnique: mockIdempotencyFind, create: mockIdempotencyCreate },
    connectionReadiness: { upsert: mockReadinessUpsert },
    schoolConnection: { update: mockConnectionUpdate },
  },
}));

import { POST as enableProduction } from '@/app/api/admin/connections/[id]/production/route';
import { PUT as putAvailability } from '@/app/v1/connections/[id]/availability/route';

const SECRET = 'sandbox-secret';
let nowIso = new Date().toISOString();

function credential() {
  return {
    id: 'cred_a',
    partnerKey: 'partner_a',
    environment: 'sandbox',
    schoolConnectionId: 'conn_a',
    revokedAt: null,
    connection: { id: 'conn_a', listingId: 'school_a', environment: 'sandbox', status: 'inactive' },
  };
}

function signed(path: string, body: unknown, connectionId = 'conn_a') {
  const raw = JSON.stringify(body);
  const signature = signPartnerRequest({
    secret: SECRET,
    method: 'PUT',
    path,
    timestamp: nowIso,
    body: raw,
  });
  return new Request(`http://localhost${path}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      'x-dlu-partner-id': 'cred_a',
      'x-dlu-timestamp': nowIso,
      'x-dlu-signature': signature,
      'x-dlu-connection-id': connectionId,
    },
    body: raw,
  });
}

const windowBody = {
  windows: [
    {
      offering_ref: 'off_b1_60min',
      starts_at: '2026-11-03T08:00:00+01:00',
      ends_at: '2026-11-03T09:00:00+01:00',
      resource_bundle: {
        instructor_ref: 'ins_anna',
        vehicle_ref: 'veh_124',
        location_ref: 'loc_main',
      },
      price: { amount_minor: 76000, currency: 'SEK' },
      idempotency_key: 'win_20261103_anna_0800',
    },
  ],
};

beforeEach(() => {
  nowIso = new Date().toISOString();
  process.env.CONNECTIVITY_API = '1';
  process.env.CONNECTIVITY_PARTNER_SECRETS = JSON.stringify({ cred_a: SECRET });
  process.env.CONNECTIVITY_RATE_LIMIT = '60';
  resetRateLimits();
  mockCredentialFind.mockReset();
  mockCredentialMany.mockReset();
  mockIdempotencyFind.mockReset();
  mockIdempotencyCreate.mockReset();
  mockReadinessUpsert.mockClear();
  mockConnectionUpdate.mockClear();
  mockSession.mockReset();
  mockCredentialFind.mockResolvedValue(credential());
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
});

afterEach(() => {
  delete process.env.CONNECTIVITY_API;
  delete process.env.CONNECTIVITY_PARTNER_SECRETS;
  delete process.env.CONNECTIVITY_RATE_LIMIT;
  resetRateLimits();
});

describe('connectivity routes', () => {
  it('stays dark while the connectivity flag is off', async () => {
    delete process.env.CONNECTIVITY_API;
    const res = await putAvailability(signed('/v1/connections/conn_a/availability', windowBody), {
      params: Promise.resolve({ id: 'conn_a' }),
    });
    expect(res.status).toBe(404);
    expect(mockCredentialFind).not.toHaveBeenCalled();
  });

  it('SC-9 rejects a credential for connection A when the request targets connection B', async () => {
    const res = await putAvailability(
      signed('/v1/connections/conn_b/availability', windowBody, 'conn_a'),
      {
        params: Promise.resolve({ id: 'conn_b' }),
      },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: 'connection_mismatch', retryable: false },
    });
    expect(mockIdempotencyCreate).not.toHaveBeenCalled();
  });

  it('replays an availability key and rejects the same key with a different payload', async () => {
    const stored = new Map<
      string,
      { payloadHash: string; responseStatus: number; responseBody: unknown }
    >();
    mockIdempotencyFind.mockImplementation(
      async (args: {
        where: {
          schoolConnectionId_operationType_idempotencyKey: {
            schoolConnectionId: string;
            operationType: string;
            idempotencyKey: string;
          };
        };
      }) => {
        const key = args.where.schoolConnectionId_operationType_idempotencyKey;
        return stored.get(`${key.operationType}:${key.idempotencyKey}`) ?? null;
      },
    );
    mockIdempotencyCreate.mockImplementation(
      async (args: {
        data: {
          operationType: string;
          idempotencyKey: string;
          payloadHash: string;
          responseStatus: number;
          responseBody: unknown;
        };
      }) => {
        stored.set(`${args.data.operationType}:${args.data.idempotencyKey}`, args.data);
        return args.data;
      },
    );

    const first = await putAvailability(signed('/v1/connections/conn_a/availability', windowBody), {
      params: Promise.resolve({ id: 'conn_a' }),
    });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ accepted: 1, duplicates: 0 });

    const replay = await putAvailability(
      signed('/v1/connections/conn_a/availability', windowBody),
      {
        params: Promise.resolve({ id: 'conn_a' }),
      },
    );
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ accepted: 0, duplicates: 1 });

    const changed = {
      windows: [{ ...windowBody.windows[0], price: { amount_minor: 1, currency: 'SEK' } }],
    };
    const conflict = await putAvailability(signed('/v1/connections/conn_a/availability', changed), {
      params: Promise.resolve({ id: 'conn_a' }),
    });
    expect(conflict.status).toBe(422);
    expect(await conflict.json()).toMatchObject({ error: { code: 'idempotency_key_conflict' } });
  });

  it('SC-7 refuses production enablement when the only evidence is a mock', async () => {
    const res = await enableProduction(
      new Request('http://localhost/api/admin/connections/conn_a/production', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ evidenceSource: 'mock' }),
      }),
      { params: Promise.resolve({ id: 'conn_a' }) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: { code: 'mock_evidence_refused', retryable: false },
      prodEnabled: false,
    });
    expect(mockReadinessUpsert).not.toHaveBeenCalled();
    expect(mockConnectionUpdate).not.toHaveBeenCalled();
  });

  it('returns 429 when the partner budget is exhausted', async () => {
    process.env.CONNECTIVITY_RATE_LIMIT = '1';
    resetRateLimits();
    mockIdempotencyFind.mockResolvedValue(null);
    mockIdempotencyCreate.mockResolvedValue({});
    const path = '/v1/connections/conn_a/availability';
    const first = await putAvailability(signed(path, windowBody), {
      params: Promise.resolve({ id: 'conn_a' }),
    });
    expect(first.status).toBe(200);
    const second = await putAvailability(signed(path, windowBody), {
      params: Promise.resolve({ id: 'conn_a' }),
    });
    expect(second.status).toBe(429);
    expect(second.headers.get('retry-after')).toBeTruthy();
    expect(await second.json()).toMatchObject({ error: { code: 'rate_limited', retryable: true } });
  });
});
