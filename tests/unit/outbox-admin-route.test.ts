import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSession, mockFindMany, mockUpdate, mockFindUnique, mockOpsCreate } = vi.hoisted(() => ({
  mockSession: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(async () => ({})),
  mockFindUnique: vi.fn(),
  mockOpsCreate: vi.fn(async () => ({ id: 'ops_1' })),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    commandOutbox: { findMany: mockFindMany, update: mockUpdate, findUnique: mockFindUnique },
    opsTask: { create: mockOpsCreate },
  },
}));

import { POST as resolve } from '@/app/api/admin/outbox/[id]/resolve/route';
import { POST as tick } from '@/app/api/admin/outbox/tick/route';

beforeEach(() => {
  process.env.RELIABLE_PROCESSING = '1';
  mockSession.mockReset();
  mockFindMany.mockReset();
  mockUpdate.mockClear();
  mockFindUnique.mockReset();
  mockOpsCreate.mockClear();
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
});

afterEach(() => {
  delete process.env.RELIABLE_PROCESSING;
});

describe('outbox admin routes', () => {
  it('SC-12 dead-letters a poison command with a redacted payload and an ops task', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'cmd_1',
        commandType: 'partner_commit',
        attemptCount: 4,
        payload: { studentEmail: 'ada@example.test', command: 'commit' },
        quarantineResourceRef: 'slot_1',
      },
    ]);

    const res = await tick();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ processed: 1, deadLettered: 1 });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'failed_terminal',
          outcome: 'unresolved',
          attemptCount: 5,
          redactedPayload: { studentEmail: '[redacted]', command: 'commit' },
        }),
      }),
    );
    expect(JSON.stringify(mockUpdate.mock.calls)).not.toContain('quarantineResourceRef');
    expect(mockOpsCreate).toHaveBeenCalledOnce();
  });

  it('SC-20 refuses to release quarantine when the hold TTL expired', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'cmd_1' });
    const res = await resolve(
      new Request('http://localhost/api/admin/outbox/cmd_1/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind: 'ttl_expired' }),
      }),
      { params: Promise.resolve({ id: 'cmd_1' }) },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: { code: 'quarantine_held' } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('SC-20 releases quarantine only for an audited decision with a rationale', async () => {
    mockFindUnique.mockResolvedValueOnce({ id: 'cmd_1' });
    const res = await resolve(
      new Request('http://localhost/api/admin/outbox/cmd_1/resolve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'audited_decision',
          rationale: 'Vendor console shows the reservation was not committed.',
        }),
      }),
      { params: Promise.resolve({ id: 'cmd_1' }) },
    );
    expect(res.status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resolutionKind: 'audited_decision' }),
      }),
    );
  });
});
