import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSession, mockFindUnique, mockUpdate, mockPartnerFind } = vi.hoisted(() => ({
  mockSession: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn(async () => ({})),
  mockPartnerFind: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    certification: { findUnique: mockFindUnique, update: mockUpdate },
    partner: { findMany: mockPartnerFind },
  },
}));

import { POST as enable } from '@/app/api/admin/certifications/[id]/enable/route';
import { GET as directory } from '@/app/api/partners/route';

beforeEach(() => {
  delete process.env.CERTIFICATION_ENFORCEMENT;
  mockSession.mockReset();
  mockFindUnique.mockReset();
  mockUpdate.mockClear();
  mockPartnerFind.mockReset();
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
});

describe('capability enablement', () => {
  it('refuses transactional booking when the evidence is only an availability milestone', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'cert_1',
      milestoneEvidence: { source: 'sandbox', milestone3: true, milestone5: false },
      prodEnabled: { availability_display: true },
    });
    const res = await enable(
      new Request('http://localhost/api/admin/certifications/cert_1/enable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capability: 'transactional_booking' }),
      }),
      { params: Promise.resolve({ id: 'cert_1' }) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'milestone_5_required' } });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('enables availability display from sandbox milestone 3 without enabling booking', async () => {
    mockFindUnique.mockResolvedValueOnce({
      id: 'cert_1',
      milestoneEvidence: { source: 'sandbox', milestone3: true },
      prodEnabled: {},
    });
    const res = await enable(
      new Request('http://localhost/api/admin/certifications/cert_1/enable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capability: 'availability_display' }),
      }),
      { params: Promise.resolve({ id: 'cert_1' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'cert_1',
      prodEnabled: { availability_display: true },
    });
  });

  it('hides the partner directory while certification enforcement is off', async () => {
    const res = await directory();
    expect(res.status).toBe(404);
    expect(mockPartnerFind).not.toHaveBeenCalled();
  });
});
