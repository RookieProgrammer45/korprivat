import { beforeEach, describe, expect, it, vi } from 'vitest';
import { leadDashboardDecision } from '@/lib/acquisition/lead-dashboard-policy';

const {
  mockRequireAuth,
  mockRepresentative,
  mockCount,
  mockEvents,
  mockGrant,
  mockInquiry,
  mockInstructor,
} = vi.hoisted(() => ({
  mockRequireAuth: vi.fn(),
  mockRepresentative: vi.fn(),
  mockCount: vi.fn(),
  mockEvents: vi.fn(),
  mockGrant: vi.fn(),
  mockInquiry: vi.fn(),
  mockInstructor: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));
vi.mock('@/lib/db', () => ({
  prisma: {
    listingRepresentativeAuthority: { findUnique: mockRepresentative },
    offeringRequest: { count: mockCount, findFirst: mockInquiry },
    schoolAuthorizationEvent: { findMany: mockEvents, create: mockGrant },
    instructor: { findUnique: mockInstructor },
  },
}));

import { POST as convertLead } from '@/app/api/listings/[id]/leads/[inquiryId]/convert/route';
import { GET as leads } from '@/app/api/listings/[id]/leads/route';

beforeEach(() => {
  delete process.env.LEAD_DASHBOARD;
  delete process.env.SCHOOL_AUTHZ_ENFORCEMENT;
  mockRequireAuth.mockReset();
  mockRepresentative.mockReset();
  mockCount.mockReset();
  mockEvents.mockReset();
  mockGrant.mockReset();
  mockInquiry.mockReset();
  mockInstructor.mockReset();
  mockRequireAuth.mockResolvedValue({ id: 'rep_1', email: 'school@example.com' });
  mockEvents.mockResolvedValue([]);
});

describe('lead dashboard', () => {
  it('SC-24 shows historical inquiries for a zero-scope school and collects nothing new', () => {
    const decision = leadDashboardDecision({
      representativeVerified: true,
      grantedScopes: [],
      historicalInquiryCount: 2,
    });
    expect(decision).toMatchObject({
      visible: true,
      bookingSurfaces: false,
      collectNewInquiries: false,
      historicalInquiries: 2,
      prompts: [{ scope: 'inquiry_collection', reason: 'historical_inquiries' }],
    });
    expect(
      leadDashboardDecision({
        representativeVerified: false,
        grantedScopes: [],
        historicalInquiryCount: 2,
      }).visible,
    ).toBe(false);
  });

  it('hides the dashboard while the flag is off', async () => {
    const res = await leads(new Request('http://localhost/api/listings/school_1/leads'), {
      params: Promise.resolve({ id: 'school_1' }),
    });
    expect(res.status).toBe(404);
    expect(mockCount).not.toHaveBeenCalled();
    expect(mockRepresentative).not.toHaveBeenCalled();
  });

  it('returns the zero-scope view to a verified representative', async () => {
    process.env.LEAD_DASHBOARD = '1';
    mockRepresentative.mockResolvedValue({
      verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
      evidenceRef: 'rep_evidence',
    });
    mockCount.mockResolvedValue(2);
    const res = await leads(new Request('http://localhost/api/listings/school_1/leads'), {
      params: Promise.resolve({ id: 'school_1' }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      bookingSurfaces: false,
      collectNewInquiries: false,
      historicalInquiries: 2,
    });
    delete process.env.LEAD_DASHBOARD;
  });

  it('refuses to turn a lead into a booking or a scope', async () => {
    process.env.LEAD_DASHBOARD = '1';
    process.env.SCHOOL_AUTHZ_ENFORCEMENT = '1';
    mockRepresentative.mockResolvedValue({
      verifiedAt: new Date('2026-10-01T00:00:00.000Z'),
      evidenceRef: 'rep_evidence',
    });
    mockInquiry.mockResolvedValue({ id: 'inq_1' });
    mockInstructor.mockResolvedValue({ bookingMode: 'request' });
    const res = await convertLead(
      new Request('http://localhost/api/listings/school_1/leads/inq_1/convert', { method: 'POST' }),
      { params: Promise.resolve({ id: 'school_1', inquiryId: 'inq_1' }) },
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: 'not_authorized_by_school',
      bookingCreated: false,
      authorizationEventsCreated: 0,
      scopesGranted: [],
    });
    expect(mockGrant).not.toHaveBeenCalled();
    delete process.env.LEAD_DASHBOARD;
    delete process.env.SCHOOL_AUTHZ_ENFORCEMENT;
  });
});
