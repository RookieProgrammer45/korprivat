import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumesSeat,
  isSessionDiscoverable,
  remainingSeats,
  riskCourseAcceptDecision,
  riskCoursePublishDecision,
  riskCourseRequestDecision,
  seatDisplayIsHold,
} from '@/lib/discovery/risk-course-policy';
import { foldAuthorizationEvents } from '@/lib/orgs/school-authorization-policy';

const {
  mockFindManySessions,
  mockCreateSession,
  mockCreateRequest,
  mockFindFirstSession,
  mockUpdateRequest,
  mockFindFirstRequest,
  mockPermissions,
  mockAuthz,
} = vi.hoisted(() => ({
  mockFindManySessions: vi.fn(),
  mockCreateSession: vi.fn(),
  mockCreateRequest: vi.fn(),
  mockFindFirstSession: vi.fn(),
  mockUpdateRequest: vi.fn(),
  mockFindFirstRequest: vi.fn(),
  mockPermissions: vi.fn(),
  mockAuthz: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/scheduling/listing-eligibility', () => ({
  loadListingEligibilityFacts: async () => ({
    categoryAllowed: true,
    licenceStatus: 'VERIFIED',
    instructorAffiliated: true,
  }),
}));
vi.mock('@/lib/db', () => ({
  prisma: {
    riskCourseSession: {
      findMany: mockFindManySessions,
      findFirst: mockFindFirstSession,
      create: mockCreateSession,
    },
    riskCourseRequest: {
      create: mockCreateRequest,
      findFirst: mockFindFirstRequest,
      update: mockUpdateRequest,
    },
    teachingPermission: { findMany: mockPermissions },
    schoolAuthorizationEvent: { findMany: mockAuthz },
  },
}));

import {
  acceptRiskCourseRequest,
  listDiscoverableRiskSessions,
  publishRiskCourseSession,
  requestRiskCourseSession,
} from '@/lib/discovery/risk-course-store';

const future = '2027-03-01T09:00:00.000Z';
const past = '2020-03-01T09:00:00.000Z';

beforeEach(() => {
  mockFindManySessions.mockReset();
  mockCreateSession.mockReset();
  mockCreateRequest.mockReset();
  mockFindFirstSession.mockReset();
  mockUpdateRequest.mockReset();
  mockFindFirstRequest.mockReset();
  mockPermissions.mockReset();
  mockAuthz.mockReset();
  mockAuthz.mockResolvedValue([
    {
      sequence: 1,
      kind: 'grant',
      scopes: ['request_to_book'],
      decisionVersion: 1,
      actorUserId: 'rep',
      evidenceRef: 'ev',
      note: null,
      idempotencyKey: 'g1',
      createdAt: new Date(),
    },
  ]);
  delete process.env.RISK_COURSES;
  delete process.env.SCHOOL_AUTHZ_ENFORCEMENT;
});

describe('SC-26 / SC-27 / SC-28 risk-course discovery', () => {
  it('hides unpublished drafts and does not treat a displayed seat as a hold', () => {
    expect(
      isSessionDiscoverable({
        publishedAt: null,
        approvedAt: null,
        source: 'ACQ_DRAFT',
        startsAt: future,
      }),
    ).toBe(false);
    expect(
      isSessionDiscoverable({
        publishedAt: future,
        approvedAt: future,
        source: 'SCHOOL_PUBLISHED',
        startsAt: future,
      }),
    ).toBe(true);
    expect(remainingSeats(12, 0)).toBe(12);
    expect(remainingSeats(12, 1)).toBe(11);
    expect(seatDisplayIsHold()).toBe(false);
    expect(consumesSeat({ status: 'pending', commitmentRoute: null })).toBe(false);
    expect(consumesSeat({ status: 'confirmed', commitmentRoute: 'external_manual' })).toBe(false);
    expect(consumesSeat({ status: 'confirmed', commitmentRoute: 'native' })).toBe(true);
  });

  it('refuses A/C/D publication for a B-only school (E1)', () => {
    expect(
      riskCoursePublishDecision({
        courseType: 'RISK_1',
        licenceCategory: 'A',
        permissions: [
          {
            category: 'B',
            legalEntityRef: 'org',
            locationRef: 'Stockholm',
            status: 'CURRENT',
          },
        ],
        listingLegalEntity: 'org',
        listingLocation: 'Stockholm',
        source: 'SCHOOL_PUBLISHED',
        schoolApproved: true,
      }),
    ).toEqual({ allowed: false, code: 'category_not_permitted' });
  });

  it('lists only published sessions when the flag is on', async () => {
    expect(
      await listDiscoverableRiskSessions({ courseType: 'RISK_1', municipality: 'stockholm' }),
    ).toEqual([]);
    process.env.RISK_COURSES = '1';
    mockFindManySessions.mockResolvedValue([
      {
        id: 'draft',
        listingId: 's1',
        courseType: 'RISK_1',
        licenceCategory: 'B',
        municipality: 'stockholm',
        location: 'Södermalm',
        startsAt: new Date(future),
        endsAt: new Date(future),
        seatCapacity: 16,
        priceSek: 1990,
        publishedAt: null,
        approvedAt: null,
        source: 'ACQ_DRAFT',
        listing: { name: 'Draft School', bookingMode: 'request' },
        requests: [],
      },
      {
        id: 'live',
        listingId: 's1',
        courseType: 'RISK_1',
        licenceCategory: 'B',
        municipality: 'stockholm',
        location: 'Södermalm',
        startsAt: new Date(future),
        endsAt: new Date(future),
        seatCapacity: 16,
        priceSek: 1990,
        publishedAt: new Date(future),
        approvedAt: new Date(future),
        source: 'SCHOOL_PUBLISHED',
        listing: { name: 'Live School', bookingMode: 'request' },
        requests: [{ status: 'pending', commitmentRoute: null }],
      },
    ]);
    const listed = await listDiscoverableRiskSessions({
      courseType: 'RISK_1',
      municipality: 'Stockholm',
    });
    expect(listed).toHaveLength(1);
    expect(listed[0]).toMatchObject({
      id: 'live',
      remainingSeats: 16,
      seatIsHold: false,
      priceSek: 1990,
    });
  });

  it('creates a request without consuming a seat and refuses an expired session', async () => {
    process.env.RISK_COURSES = '1';
    mockFindFirstSession.mockResolvedValue({
      id: 'live',
      listingId: 's1',
      courseType: 'RISK_1',
      licenceCategory: 'B',
      municipality: 'stockholm',
      location: 'Södermalm',
      startsAt: new Date(future),
      endsAt: new Date(future),
      seatCapacity: 16,
      priceSek: 1990,
      publishedAt: new Date(future),
      approvedAt: new Date(future),
      source: 'SCHOOL_PUBLISHED',
      listing: { name: 'Live School', bookingMode: 'request' },
      requests: [],
    });
    mockAuthz.mockResolvedValue([
      {
        sequence: 1,
        kind: 'grant',
        scopes: ['request_to_book'],
        decisionVersion: 1,
        actorUserId: 'rep',
        evidenceRef: 'ev',
        note: null,
        idempotencyKey: 'g1',
        createdAt: new Date(),
      },
    ]);
    mockCreateRequest.mockResolvedValue({ id: 'req-1', status: 'pending' });
    const created = await requestRiskCourseSession({
      sessionId: 'live',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      studentContactVerified: true,
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ status: 'pending', mode: 'request', seatConsumed: false });

    mockFindFirstSession.mockResolvedValue({
      id: 'old',
      listingId: 's1',
      courseType: 'RISK_1',
      licenceCategory: 'B',
      municipality: 'stockholm',
      location: 'Södermalm',
      startsAt: new Date(past),
      endsAt: new Date(past),
      seatCapacity: 16,
      priceSek: 1990,
      publishedAt: new Date(past),
      approvedAt: new Date(past),
      source: 'SCHOOL_PUBLISHED',
      listing: { name: 'Live School', bookingMode: 'request' },
      requests: [],
    });
    const expired = await requestRiskCourseSession({
      sessionId: 'old',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      studentContactVerified: true,
    });
    expect(expired).toMatchObject({ status: 403, body: { error: { code: 'session_expired' } } });
  });

  it('blocks acceptance after withdrawal while enforcement is OFF', async () => {
    process.env.RISK_COURSES = '1';
    mockAuthz.mockResolvedValue([
      {
        sequence: 1,
        kind: 'withdraw',
        scopes: ['request_to_book'],
        decisionVersion: 1,
        actorUserId: 'rep',
        evidenceRef: 'ev',
        note: null,
        idempotencyKey: 'w1',
        createdAt: new Date(),
      },
    ]);
    mockFindFirstRequest.mockResolvedValue({
      id: 'req-1',
      status: 'pending',
      sessionId: 'live',
      listingId: 's1',
    });
    mockFindFirstSession.mockResolvedValue({
      id: 'live',
      listingId: 's1',
      startsAt: new Date(future),
      listing: { bookingMode: 'request' },
    });
    const blocked = await acceptRiskCourseRequest({
      requestId: 'req-1',
      commitmentRoute: 'external_manual',
    });
    expect(blocked).toMatchObject({
      status: 403,
      body: { error: { code: 'not_authorized_by_school' } },
    });
    expect(mockUpdateRequest).not.toHaveBeenCalled();
    expect(
      riskCourseAcceptDecision({
        bookingMode: 'request',
        folded: foldAuthorizationEvents([]),
        enforcementOn: false,
        expired: false,
      }).allowed,
    ).toBe(false);
    expect(
      riskCourseRequestDecision({
        discoverable: true,
        folded: foldAuthorizationEvents([
          {
            sequence: 1,
            kind: 'grant',
            scopes: ['transactional_booking'],
            decisionVersion: 1,
            actorUserId: 'rep',
            evidenceRef: 'ev',
            note: null,
            idempotencyKey: 'g1',
            createdAt: '2026-10-23T00:00:00.000Z',
          },
        ]),
        enforcementOn: false,
        expired: false,
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
        instant: true,
        hasE4: false,
      }),
    ).toEqual({ allowed: false, code: 'E4' });
  });

  it('does not auto-publish an ACQ draft', async () => {
    process.env.RISK_COURSES = '1';
    mockPermissions.mockResolvedValue([
      {
        category: 'B',
        legalEntityRef: 'org',
        locationRef: 'Stockholm',
        status: 'CURRENT',
      },
    ]);
    const refused = await publishRiskCourseSession({
      listingId: 's1',
      courseType: 'RISK_1',
      licenceCategory: 'B',
      municipality: 'stockholm',
      location: 'Södermalm',
      startsAt: future,
      endsAt: future,
      seatCapacity: 12,
      priceSek: 1800,
      source: 'ACQ_DRAFT',
      schoolApproved: false,
      listingLegalEntity: 'org',
      listingLocation: 'Stockholm',
    });
    expect(refused).toMatchObject({
      status: 403,
      body: { error: { code: 'school_approval_required' } },
    });
    expect(mockCreateSession).not.toHaveBeenCalled();
  });
});
