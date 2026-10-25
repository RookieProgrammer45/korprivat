import { beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeStoreDecision } from '@/lib/acquisition/concierge-policy';
import {
  type AuthorizationEvent,
  canAcceptPendingRequest,
  foldAuthorizationEvents,
  planAuthorizationAppend,
} from '@/lib/orgs/school-authorization-policy';
import {
  conciergeMayPrefillScopes,
  emptyScopeDecisionForm,
  selectedScopesFromForm,
} from '@/lib/orgs/scope-decision-form';

const {
  mockRequireAuth,
  mockFindUniqueRep,
  mockFindUniqueIdempotency,
  mockFindManyEvents,
  mockCreateEvent,
  mockFindUniqueInstructor,
  mockComplaintFindMany,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockFindUniqueRep: vi.fn(),
  mockFindUniqueIdempotency: vi.fn(),
  mockFindManyEvents: vi.fn(),
  mockCreateEvent: vi.fn(),
  mockFindUniqueInstructor: vi.fn(),
  mockComplaintFindMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/db', () => ({
  prisma: {
    listingRepresentativeAuthority: { findUnique: mockFindUniqueRep },
    schoolAuthorizationEvent: {
      findUnique: mockFindUniqueIdempotency,
      findMany: mockFindManyEvents,
      create: mockCreateEvent,
    },
    instructor: { findUnique: mockFindUniqueInstructor },
    schoolComplaint: { findMany: mockComplaintFindMany },
    userProfile: { findUnique: vi.fn() },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        schoolAuthorizationEvent: {
          findUnique: mockFindUniqueIdempotency,
          findMany: mockFindManyEvents,
          create: mockCreateEvent,
        },
        instructor: { findUnique: mockFindUniqueInstructor },
        listingRepresentativeAuthority: { findUnique: mockFindUniqueRep },
        listingAuthzHead: { upsert: vi.fn() },
      }),
  },
}));

import { GET, POST } from '@/app/api/listings/[id]/authorizations/route';

const representative = {
  userId: 'rep-1',
  verifiedAt: new Date('2026-10-23T00:00:00.000Z'),
  evidenceRef: 'mandate-1',
};

function event(
  partial: Partial<AuthorizationEvent> & Pick<AuthorizationEvent, 'sequence' | 'kind'>,
): AuthorizationEvent {
  return {
    scopes: [],
    decisionVersion: partial.sequence,
    actorUserId: 'rep-1',
    evidenceRef: 'evidence-1',
    note: null,
    idempotencyKey: `key-${partial.sequence}`,
    createdAt: '2026-10-23T00:00:00.000Z',
    ...partial,
  };
}

beforeEach(() => {
  mockRequireAuth.mockReset();
  mockFindUniqueRep.mockReset();
  mockFindUniqueIdempotency.mockReset();
  mockFindManyEvents.mockReset();
  mockCreateEvent.mockReset();
  mockFindUniqueInstructor.mockReset();
  mockComplaintFindMany.mockReset();
  mockRequireAuth.mockResolvedValue({ id: 'rep-1' });
  mockFindUniqueRep.mockResolvedValue(representative);
  mockFindUniqueInstructor.mockResolvedValue({ bookingMode: 'request' });
  mockFindManyEvents.mockResolvedValue([]);
  mockFindUniqueIdempotency.mockResolvedValue(null);
  mockComplaintFindMany.mockResolvedValue([]);
  delete process.env.SCHOOL_AUTHZ_ENFORCEMENT;
  delete process.env.SCHOOL_MEDIATED_INSTRUCTORS;
});

describe('SC-21a scope decision form', () => {
  it('renders nothing pre-selected and refuses a concierge scope prefill', () => {
    const form = emptyScopeDecisionForm();
    expect(form).toEqual({
      availability_display: false,
      inquiry_collection: false,
      request_to_book: false,
      transactional_booking: false,
      payment_collection: false,
    });
    expect(selectedScopesFromForm(form)).toEqual([]);
    expect(conciergeMayPrefillScopes({ scopes: ['request_to_book'] })).toBe(false);
    expect(
      conciergeStoreDecision({
        source: 'SYNTHETIC_FIXTURE',
        provenance: {
          source: 'SYNTHETIC_FIXTURE',
          sourceUrl: 'synthetic://scopes',
          retrievedAt: '2026-10-26T00:00:00.000Z',
          fields: ['scopes'],
        },
        payload: { scopes: ['request_to_book'] },
      }),
    ).toEqual({ allowed: false, code: 'scopes_not_prefillable' });
  });

  it('GET returns an empty form even when grants already exist', async () => {
    mockFindManyEvents.mockResolvedValue([
      {
        sequence: 1,
        kind: 'grant',
        scopes: ['availability_display'],
        decisionVersion: 1,
        actorUserId: 'rep-1',
        evidenceRef: 'ev',
        note: null,
        idempotencyKey: 'k1',
        createdAt: new Date('2026-10-23T00:00:00.000Z'),
      },
    ]);
    const res = await GET(new Request('http://localhost/api/listings/school_1/authorizations'), {
      params: Promise.resolve({ id: 'school_1' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      granted: ['availability_display'],
      form: emptyScopeDecisionForm(),
    });
  });

  it('grants only the selected scopes and refuses an empty submit', async () => {
    mockCreateEvent.mockResolvedValue({
      sequence: 1,
      kind: 'grant',
      scopes: ['inquiry_collection'],
      decisionVersion: 1,
      actorUserId: 'rep-1',
      evidenceRef: 'ev-1',
      note: null,
      idempotencyKey: 'idem-grant-1',
      createdAt: new Date(),
    });
    const granted = await POST(
      new Request('http://localhost/api/listings/school_1/authorizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'grant',
          scopes: ['inquiry_collection'],
          evidenceRef: 'ev-1',
          expectedHeadSequence: 0,
          decisionVersion: 1,
          idempotencyKey: 'idem-grant-1',
        }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(granted.status).toBe(200);
    expect(mockCreateEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ scopes: ['inquiry_collection'] }),
      }),
    );

    const empty = await POST(
      new Request('http://localhost/api/listings/school_1/authorizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'grant',
          scopes: [],
          evidenceRef: 'ev-1',
          expectedHeadSequence: 0,
          decisionVersion: 1,
          idempotencyKey: 'idem-empty',
        }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(empty.status).toBe(403);
    expect(await empty.json()).toEqual({ error: 'no_scopes_selected' });
  });

  it('replays an idempotent submit without a second write', async () => {
    mockFindUniqueIdempotency.mockResolvedValue({
      sequence: 1,
      kind: 'grant',
      scopes: ['request_to_book'],
      decisionVersion: 1,
      actorUserId: 'rep-1',
      evidenceRef: 'ev-1',
      note: null,
      idempotencyKey: 'idem-replay',
      createdAt: new Date(),
    });
    const res = await POST(
      new Request('http://localhost/api/listings/school_1/authorizations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          kind: 'grant',
          scopes: ['request_to_book'],
          evidenceRef: 'ev-1',
          expectedHeadSequence: 0,
          decisionVersion: 1,
          idempotencyKey: 'idem-replay',
        }),
      }),
      { params: Promise.resolve({ id: 'school_1' }) },
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ replay: true, sequence: 1 });
    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  it('blocks acceptance after request_to_book withdrawal while enforcement is OFF', () => {
    const folded = foldAuthorizationEvents([
      event({
        sequence: 1,
        kind: 'grant',
        scopes: ['request_to_book'],
        decisionVersion: 1,
      }),
      event({
        sequence: 2,
        kind: 'withdraw',
        scopes: ['request_to_book'],
        decisionVersion: 2,
      }),
    ]);
    expect(
      canAcceptPendingRequest({
        bookingMode: 'request',
        folded,
        enforcementOn: false,
      }),
    ).toBe(false);
    expect(
      planAuthorizationAppend(foldAuthorizationEvents([]), {
        kind: 'grant',
        scopes: ['availability_display'],
        actorUserId: 'rep-1',
        evidenceRef: 'ev',
        note: null,
        expectedHeadSequence: 0,
        decisionVersion: 1,
        idempotencyKey: 'k',
        bookingMode: 'request',
        representative: {
          userId: 'rep-1',
          verifiedAt: '2026-10-23T00:00:00.000Z',
          evidenceRef: 'mandate-1',
        },
        existingIdempotencyKey: null,
      }).ok,
    ).toBe(true);
  });
});
