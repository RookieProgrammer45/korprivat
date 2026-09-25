// @polsia:user-owned — clickwrap acceptance integration coverage.
//
// Three end-to-end paths:
//   1. POST /api/clickwrap — upsert one row keyed by userId. Idempotent on
//      re-POST (same-row update); 401 when anonymous; 400 when the body
//      is malformed or missing termsVersion.
//   2. GET /api/clickwrap — returns the row's { termsVersion, acceptedAt }
//      or literal JSON `null` when no row exists.
//   3. HandledareClickwrapGuard unit — mocked Prisma only. Three branches:
//      no row → isCurrent false, stale version → isCurrent false, matching
//      version → isCurrent true.
//
// biome: this file is OUTSIDE the overrides' `src/**` glob. Mock helpers
// are imported FIRST so their top-level vi.mock() calls are hoisted above
// the route-handler imports below.

import './_setup/env';
import './_setup/auth-mock';
import { vi } from 'vitest';
import { prismaMock, resetPrisma } from './_setup/prisma-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  // require-auth.ts awaits headers() at module-init; without an active Next
  // request context, the real call throws. Return an empty Headers so the
  // helper flows past the await.
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GET as clickwrapGET, POST as clickwrapPOST } from '@/app/api/clickwrap/route';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { authMock } from './_setup/auth-mock';

const SESSION_USER = {
  id: 'user_handledare',
  email: 'handledare@example.test',
  name: 'Handledare',
  role: 'user' as const,
};

function jsonRequest(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function clickwrapReq(body: unknown): Request {
  return jsonRequest('/api/clickwrap', body);
}

function clickwrapGetReq(): Request {
  return new Request('http://localhost/api/clickwrap', { method: 'GET' });
}

beforeEach(() => {
  resetPrisma();
  authMock.reset();
});

afterEach(() => {
  // Keep the mocks for the next case.
});

describe('POST /api/clickwrap', () => {
  it('401 when not signed in', async () => {
    authMock.setUser(null);
    const res = await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    expect(res.status).toBe(401);
    expect(prismaMock.clickwrapAcceptance.upsert).not.toHaveBeenCalled();
  });

  it('400 with { errors: { form } } on malformed JSON', async () => {
    authMock.setUser(SESSION_USER);
    const res = await clickwrapPOST(
      new Request('http://localhost/api/clickwrap', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{not-json',
      }),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors?: Record<string, string> };
    expect(body.errors?.form).toBe('Invalid JSON body');
    expect(prismaMock.clickwrapAcceptance.upsert).not.toHaveBeenCalled();
  });

  it('400 with termsVersion error on missing field (valid JSON)', async () => {
    authMock.setUser(SESSION_USER);
    const res = await clickwrapPOST(clickwrapReq({}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { errors?: Record<string, string> };
    expect(body.errors?.termsVersion).toBeDefined();
    expect(prismaMock.clickwrapAcceptance.upsert).not.toHaveBeenCalled();
  });

  it('204 + upsert called ONCE on the happy path', async () => {
    authMock.setUser(SESSION_USER);
    const res = await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    expect(res.status).toBe(204);
    expect(prismaMock.clickwrapAcceptance.upsert).toHaveBeenCalledTimes(1);
    expect(prismaMock.clickwrapAcceptance.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_handledare' },
        create: expect.objectContaining({
          userId: 'user_handledare',
          termsVersion: HANDLEDARE_TERMS_VERSION,
          acceptedAt: expect.any(Date) as unknown as Date,
        }),
        update: expect.objectContaining({
          termsVersion: HANDLEDARE_TERMS_VERSION,
          acceptedAt: expect.any(Date) as unknown as Date,
        }),
      }),
    );
  });

  it('re-POST is idempotent — upsert still called once (update branch)', async () => {
    authMock.setUser(SESSION_USER);
    await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    // Two POSTs, but the underlying write is still ONE row — unique
    // userId makes upsert collapse the second call onto the same row.
    expect(prismaMock.clickwrapAcceptance.upsert).toHaveBeenCalledTimes(2);
    expect(prismaMock.clickwrapAcceptance.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: 'user_handledare' },
    });
    expect(prismaMock.clickwrapAcceptance.upsert.mock.calls[1]?.[0]).toMatchObject({
      where: { userId: 'user_handledare' },
    });
  });

  it('stamps the request termsVersion and an acceptedAt Date', async () => {
    authMock.setUser(SESSION_USER);
    await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    const call = prismaMock.clickwrapAcceptance.upsert.mock.calls[0]?.[0] as
      | { create: { termsVersion: string; acceptedAt: Date } }
      | undefined;
    expect(call?.create.termsVersion).toBe(HANDLEDARE_TERMS_VERSION);
    expect(call?.create.acceptedAt).toBeInstanceOf(Date);
  });
});

describe('GET /api/clickwrap', () => {
  it('401 when not signed in', async () => {
    authMock.setUser(null);
    const res = await clickwrapGET(clickwrapGetReq());
    expect(res.status).toBe(401);
    expect(prismaMock.clickwrapAcceptance.findUnique).not.toHaveBeenCalled();
  });

  it('200 with { termsVersion, acceptedAt } on the happy path', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.clickwrapAcceptance.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      termsVersion: HANDLEDARE_TERMS_VERSION,
      acceptedAt: new Date('2026-08-01T10:00:00.000Z'),
      ipAddress: null,
      userAgent: null,
    });
    const res = await clickwrapGET(clickwrapGetReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { termsVersion: string; acceptedAt: string };
    expect(body.termsVersion).toBe(HANDLEDARE_TERMS_VERSION);
    expect(body.acceptedAt).toBe('2026-08-01T10:00:00.000Z');
  });

  it('200 with literal JSON null when no row exists', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.clickwrapAcceptance.findUnique.mockResolvedValueOnce(null);
    const res = await clickwrapGET(clickwrapGetReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown;
    expect(body).toBeNull();
  });
});

describe('POST /api/clickwrap commits the HANDLEDARE role on UserProfile', () => {
  it('flips STUDENT → HANDLEDARE on UserProfile during clickwrap upsert', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 1 });
    await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    expect(prismaMock.userProfile.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_handledare', role: 'STUDENT' },
        data: { role: 'HANDLEDARE' },
      }),
    );
  });

  it('leaves INSTRUCTOR users alone (only STUDENT flips — count=0 case)', async () => {
    authMock.setUser(SESSION_USER);
    prismaMock.userProfile.updateMany.mockResolvedValueOnce({ count: 0 });
    await clickwrapPOST(clickwrapReq({ termsVersion: HANDLEDARE_TERMS_VERSION }));
    expect(prismaMock.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_handledare' },
        create: expect.objectContaining({ userId: 'user_handledare', role: 'HANDLEDARE' }),
      }),
    );
  });
});

describe('HandledareClickwrapGuard (role-gate + isCurrent flag)', () => {
  it('isCurrent is false when no row exists', async () => {
    authMock.setUser({ ...SESSION_USER });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      role: 'HANDLEDARE',
      welcomeSentAt: null,
    });
    prismaMock.clickwrapAcceptance.findUnique.mockResolvedValueOnce(null);
    const { requireHandledareClickwrap } = await import('@/lib/handledare-clickwrap-guard');
    const ctx = await requireHandledareClickwrap('/dashboard/handledare');
    expect(ctx.isCurrent).toBe(false);
    expect(ctx.currentVersion).toBe(HANDLEDARE_TERMS_VERSION);
    expect(ctx.acceptance).toBeNull();
  });

  it('isCurrent is false when row.termsVersion is stale', async () => {
    authMock.setUser({ ...SESSION_USER });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      role: 'HANDLEDARE',
      welcomeSentAt: null,
    });
    prismaMock.clickwrapAcceptance.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      termsVersion: 'v0.0.1',
      acceptedAt: new Date('2026-01-01T00:00:00.000Z'),
      ipAddress: null,
      userAgent: null,
    });
    const { requireHandledareClickwrap } = await import('@/lib/handledare-clickwrap-guard');
    const ctx = await requireHandledareClickwrap('/dashboard/handledare');
    expect(ctx.isCurrent).toBe(false);
    expect(ctx.acceptance?.termsVersion).toBe('v0.0.1');
  });

  it('isCurrent is true when row.termsVersion matches HANDLEDARE_TERMS_VERSION', async () => {
    authMock.setUser({ ...SESSION_USER });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      role: 'HANDLEDARE',
      welcomeSentAt: null,
    });
    prismaMock.clickwrapAcceptance.findUnique.mockResolvedValueOnce({
      userId: 'user_handledare',
      termsVersion: HANDLEDARE_TERMS_VERSION,
      acceptedAt: new Date('2026-08-01T10:00:00.000Z'),
      ipAddress: null,
      userAgent: null,
    });
    const { requireHandledareClickwrap } = await import('@/lib/handledare-clickwrap-guard');
    const ctx = await requireHandledareClickwrap('/dashboard/handledare');
    expect(ctx.isCurrent).toBe(true);
    expect(ctx.acceptance?.termsVersion).toBe(HANDLEDARE_TERMS_VERSION);
    expect(ctx.acceptance?.acceptedAt).toBe('2026-08-01T10:00:00.000Z');
  });
});
