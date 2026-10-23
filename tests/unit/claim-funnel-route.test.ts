import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockSession,
  mockProspectFind,
  mockProspectCreate,
  mockProspectUpdate,
  mockClaimCreate,
  mockClaimFind,
  mockClaimUpdate,
  mockGrantCreate,
} = vi.hoisted(() => ({
  mockSession: vi.fn(),
  mockProspectFind: vi.fn(),
  mockProspectCreate: vi.fn(),
  mockProspectUpdate: vi.fn(),
  mockClaimCreate: vi.fn(),
  mockClaimFind: vi.fn(),
  mockClaimUpdate: vi.fn(),
  mockGrantCreate: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/db', () => ({
  prisma: {
    listingProspect: {
      findUnique: mockProspectFind,
      create: mockProspectCreate,
      update: mockProspectUpdate,
    },
    prospectClaim: {
      create: mockClaimCreate,
      findFirst: mockClaimFind,
      update: mockClaimUpdate,
    },
    schoolAuthorizationEvent: { create: mockGrantCreate },
  },
}));

import { POST as reviewChecks } from '@/app/api/admin/prospects/[id]/checks/route';
import { POST as reviewClaim } from '@/app/api/admin/prospects/[id]/claim-review/route';
import { POST as importProspect } from '@/app/api/admin/prospects/route';
import { POST as submitClaim } from '@/app/api/prospects/[id]/claim/route';
import { GET as publicProspect } from '@/app/api/prospects/[id]/route';

beforeEach(() => {
  delete process.env.CLAIM_FUNNEL;
  mockSession.mockReset();
  mockProspectFind.mockReset();
  mockProspectCreate.mockReset();
  mockProspectUpdate.mockReset();
  mockClaimCreate.mockReset();
  mockClaimFind.mockReset();
  mockClaimUpdate.mockReset();
  mockGrantCreate.mockReset();
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
});

describe('claim funnel routes', () => {
  it('SC-21 returns nothing for a private prospect and does not query while the flag is off', async () => {
    const hidden = await publicProspect(new Request('http://localhost/api/prospects/p1'), {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(hidden.status).toBe(404);
    expect(mockProspectFind).not.toHaveBeenCalled();
  });

  it('shows an eligible unclaimed prospect without booking surfaces', async () => {
    process.env.CLAIM_FUNNEL = '1';
    mockProspectFind.mockResolvedValueOnce({
      id: 'p1',
      legalName: 'Synthetic Trafikskola',
      city: 'Sjöbo',
      categories: ['A', 'C', 'D'],
      visibility: 'PUBLIC',
      claimState: 'UNCLAIMED',
      eligibility: 'ELIGIBLE',
      dataQuality: 'PASS',
    });
    const res = await publicProspect(new Request('http://localhost/api/prospects/p1'), {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      claimState: 'UNCLAIMED',
      categories: ['A', 'C', 'D'],
      bookingSurfaces: false,
    });
    delete process.env.CLAIM_FUNNEL;
  });

  it('refuses a register import and creates no authorization grant', async () => {
    process.env.CLAIM_FUNNEL = '1';
    const res = await importProspect(
      new Request('http://localhost/api/admin/prospects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          legalName: 'Register School',
          orgNumber: '556000-0000',
          country: 'SE',
          city: 'Malmö',
          categories: ['B', 'C'],
          source: 'REGISTER_SCRAPE',
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mockProspectCreate).not.toHaveBeenCalled();
    expect(mockGrantCreate).not.toHaveBeenCalled();
    delete process.env.CLAIM_FUNNEL;
  });

  it('publishes after eligibility checks without requiring a claim or granting scopes', async () => {
    process.env.CLAIM_FUNNEL = '1';
    mockProspectFind.mockResolvedValueOnce({ id: 'p1', claimState: 'UNCLAIMED' });
    mockProspectUpdate.mockResolvedValueOnce({ id: 'p1' });
    const res = await reviewChecks(
      new Request('http://localhost/api/admin/prospects/p1/checks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eligibility: 'ELIGIBLE', dataQuality: 'PASS' }),
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'p1', visibility: 'PUBLIC', scopesGranted: [] });
    expect(mockGrantCreate).not.toHaveBeenCalled();
    delete process.env.CLAIM_FUNNEL;
  });

  it('keeps scopes empty after identity, mandate, and representative are verified', async () => {
    process.env.CLAIM_FUNNEL = '1';
    mockSession.mockResolvedValue({ user: { id: 'user_1', role: 'user' } });
    mockProspectFind.mockResolvedValueOnce({ id: 'p1' });
    mockClaimCreate.mockResolvedValueOnce({ id: 'claim_1' });
    mockProspectUpdate.mockResolvedValueOnce({ id: 'p1' });
    const submitted = await submitClaim(
      new Request('http://localhost/api/prospects/p1/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          identityEvidenceRef: 'didit_session_ref',
          mandateEvidenceRef: 'manual_mandate_ref',
        }),
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(submitted.status).toBe(202);
    expect(await submitted.json()).toMatchObject({
      scopesGranted: [],
      authorizationEventsCreated: 0,
      code: 'verification_incomplete',
    });

    mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
    mockClaimFind.mockResolvedValueOnce({ id: 'claim_1' });
    mockClaimUpdate.mockResolvedValueOnce({ id: 'claim_1' });
    const reviewed = await reviewClaim(
      new Request('http://localhost/api/admin/prospects/p1/claim-review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          identityStatus: 'VERIFIED',
          mandateStatus: 'VERIFIED',
          representativeStatus: 'VERIFIED',
        }),
      }),
      { params: Promise.resolve({ id: 'p1' }) },
    );
    expect(reviewed.status).toBe(200);
    expect(await reviewed.json()).toEqual({
      scopesGranted: [],
      authorizationEventsCreated: 0,
      code: 'claim_does_not_grant_scopes',
    });
    expect(mockGrantCreate).not.toHaveBeenCalled();
    delete process.env.CLAIM_FUNNEL;
  });
});
