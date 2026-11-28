import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  conciergePublishDecision,
  conciergeStoreDecision,
} from '@/lib/acquisition/concierge-policy';

const {
  mockSession,
  mockRequireAuth,
  mockCreate,
  mockFindFirst,
  mockFindMany,
  mockUpdate,
  mockRepresentative,
  mockGrant,
  mockPolicy,
} = vi.hoisted(() => ({
  mockSession: vi.fn(),
  mockRequireAuth: vi.fn(),
  mockCreate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockRepresentative: vi.fn(),
  mockGrant: vi.fn(),
  mockPolicy: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockSession } } }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/db', () => ({
  prisma: {
    conciergeDraft: {
      create: mockCreate,
      findFirst: mockFindFirst,
      findMany: mockFindMany,
      update: mockUpdate,
    },
    listingRepresentativeAuthority: { findUnique: mockRepresentative },
    schoolAuthorizationEvent: { create: mockGrant },
    cancellationPolicy: { create: mockPolicy },
  },
}));

import { POST as adminCreate } from '@/app/api/admin/concierge-drafts/route';
import { POST as schoolAction } from '@/app/api/listings/[id]/concierge-drafts/[draftId]/route';

const provenance = {
  source: 'SYNTHETIC_FIXTURE',
  sourceUrl: 'synthetic://sjobo-trafikskola',
  retrievedAt: '2026-10-24T00:00:00.000Z',
  fields: ['legalName', 'city', 'categories'],
};

const payload = {
  legalName: 'Sjöbo Trafikskola',
  city: 'Sjöbo',
  categories: ['B'],
};

beforeEach(() => {
  delete process.env.CONCIERGE_ONBOARDING;
  mockSession.mockReset();
  mockRequireAuth.mockReset();
  mockCreate.mockReset();
  mockFindFirst.mockReset();
  mockFindMany.mockReset();
  mockUpdate.mockReset();
  mockRepresentative.mockReset();
  mockGrant.mockReset();
  mockPolicy.mockReset();
  mockSession.mockResolvedValue({ user: { id: 'admin_1', role: 'admin' } });
  mockRequireAuth.mockResolvedValue({ id: 'rep_1' });
});

describe('concierge onboarding', () => {
  it('SC-25 stores a draft with provenance and manufactures no approvals', () => {
    const stored = conciergeStoreDecision({
      source: 'SYNTHETIC_FIXTURE',
      provenance,
    });
    expect(stored).toMatchObject({
      allowed: true,
      state: 'DRAFT',
      published: false,
      policyApproved: false,
      verificationManufactured: false,
      authorizationEventsCreated: 0,
      scopesGranted: [],
    });
    expect(conciergeStoreDecision({ source: 'REGISTER_SCRAPE', provenance }).allowed).toBe(false);
    expect(conciergePublishDecision({ schoolApproved: false })).toMatchObject({
      allowed: false,
      code: 'school_approval_required',
      published: false,
    });
  });

  it('hides concierge routes while the flag is off', async () => {
    const res = await adminCreate(
      new Request('http://localhost/api/admin/concierge-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          listingId: 'school_1',
          source: 'SYNTHETIC_FIXTURE',
          provenance,
          payload,
        }),
      }),
    );
    expect(res.status).toBe(404);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockFindMany).not.toHaveBeenCalled();
  });

  it('refuses a register scrape and creates no authorization or policy', async () => {
    process.env.CONCIERGE_ONBOARDING = '1';
    const res = await adminCreate(
      new Request('http://localhost/api/admin/concierge-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          listingId: 'school_1',
          source: 'REGISTER_SCRAPE',
          provenance: { ...provenance, source: 'REGISTER_SCRAPE' },
          payload,
        }),
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'register_rights_unverified' } });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
    expect(mockPolicy).not.toHaveBeenCalled();
    delete process.env.CONCIERGE_ONBOARDING;
  });

  it('lets a representative approve without publishing or granting scopes', async () => {
    process.env.CONCIERGE_ONBOARDING = '1';
    mockRepresentative.mockResolvedValue({
      verifiedAt: new Date('2026-10-01'),
      evidenceRef: 'rep_doc',
    });
    mockFindFirst.mockResolvedValue({
      id: 'draft_1',
      listingId: 'school_1',
      source: 'SYNTHETIC_FIXTURE',
      provenance,
      payload,
      state: 'DRAFT',
      approvedAt: null,
      publishedAt: null,
    });
    mockUpdate.mockResolvedValue({
      id: 'draft_1',
      listingId: 'school_1',
      source: 'SYNTHETIC_FIXTURE',
      provenance,
      payload,
      state: 'SCHOOL_APPROVED',
      approvedAt: new Date('2026-10-24'),
      publishedAt: null,
    });
    const res = await schoolAction(
      new Request('http://localhost/api/listings/school_1/concierge-drafts/draft_1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      }),
      { params: Promise.resolve({ id: 'school_1', draftId: 'draft_1' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      state: 'SCHOOL_APPROVED',
      published: false,
      policyApproved: false,
      verificationManufactured: false,
      authorizationEventsCreated: 0,
      scopesGranted: [],
      bookingSurfaces: false,
    });
    expect(mockGrant).not.toHaveBeenCalled();
    expect(mockPolicy).not.toHaveBeenCalled();
    delete process.env.CONCIERGE_ONBOARDING;
  });

  it('refuses publication until the school has approved the draft', async () => {
    process.env.CONCIERGE_ONBOARDING = '1';
    mockRepresentative.mockResolvedValue({
      verifiedAt: new Date('2026-10-01'),
      evidenceRef: 'rep_doc',
    });
    mockFindFirst.mockResolvedValue({
      id: 'draft_1',
      listingId: 'school_1',
      source: 'SYNTHETIC_FIXTURE',
      provenance,
      payload,
      state: 'DRAFT',
      approvedAt: null,
      publishedAt: null,
    });
    const res = await schoolAction(
      new Request('http://localhost/api/listings/school_1/concierge-drafts/draft_1', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'publish' }),
      }),
      { params: Promise.resolve({ id: 'school_1', draftId: 'draft_1' }) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: { code: 'school_approval_required' } });
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
    delete process.env.CONCIERGE_ONBOARDING;
  });

  it('stores an unsent outreach sequence without granting scopes', async () => {
    process.env.CONCIERGE_ONBOARDING = '1';
    const { buildOutreachSequence } = await import('@/lib/acquisition/outreach-sequence-policy');
    const sequence = buildOutreachSequence({
      schoolName: 'Example Trafikskola (synthetic)',
      listingId: 'listing-synthetic',
    });
    expect(sequence.allowed).toBe(true);
    if (!sequence.allowed) {
      return;
    }
    const { allowed: _allowed, ...payload } = sequence;
    mockCreate.mockResolvedValue({
      id: 'draft_outreach',
      listingId: 'listing-synthetic',
      source: 'SYNTHETIC_FIXTURE',
      provenance,
      payload,
      state: 'DRAFT',
      approvedAt: null,
      publishedAt: null,
    });
    const res = await adminCreate(
      new Request('http://localhost/api/admin/concierge-drafts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          listingId: 'listing-synthetic',
          source: 'SYNTHETIC_FIXTURE',
          provenance: {
            source: 'SYNTHETIC_FIXTURE',
            sourceUrl: 'synthetic://outreach-sequence',
            retrievedAt: '2026-10-24T00:00:00.000Z',
            fields: ['outreachSequence'],
          },
          payload,
        }),
      }),
    );
    expect(res.status).toBe(201);
    expect(mockCreate).toHaveBeenCalled();
    expect(mockGrant).not.toHaveBeenCalled();
    expect(payload.sent).toBe(false);
    delete process.env.CONCIERGE_ONBOARDING;
  });
});
