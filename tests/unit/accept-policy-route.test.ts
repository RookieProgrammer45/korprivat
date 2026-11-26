import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBookingFindUnique,
  mockBookingUpdateMany,
  mockInstructorFindUnique,
  mockSlotUpdateMany,
  mockCreateCheckout,
  mockAuthzEvents,
} = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockSlotUpdateMany: vi.fn(),
  mockCreateCheckout: vi.fn(async () => ({ url: 'https://checkout.test/session' })),
  mockAuthzEvents: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique, updateMany: mockBookingUpdateMany },
    instructor: { findUnique: mockInstructorFindUnique },
    availabilitySlot: { updateMany: mockSlotUpdateMany },
    schoolAuthorizationEvent: { findMany: mockAuthzEvents },
  },
}));
vi.mock('@/lib/require-auth', () => ({ getSessionUser: vi.fn(async () => null) }));
vi.mock('@/lib/business/escrow', () => ({
  assertTokenMatches: () => true,
  generateBookingToken: () => 'action-token',
}));
vi.mock('@/lib/business/booking-access', () => ({
  generateLearnerAccessToken: () => ({ token: 'learner-token', tokenHash: 'hash' }),
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => ({ id: 'mail' })) }));
vi.mock('@/lib/email/templates', () => ({
  bookingRequestApprovedEmail: () => ({ subject: 'ok', text: 'ok', html: 'ok' }),
  bookingRequestApprovedInstructorCopyEmail: () => ({ subject: 'ok', text: 'ok', html: 'ok' }),
}));
vi.mock('@/lib/payments/create-booking-checkout', () => ({
  createBookingCheckoutSession: mockCreateCheckout,
  CheckoutConfigurationError: class CheckoutConfigurationError extends Error {},
  IndependentInstructorPaymentError: class IndependentInstructorPaymentError extends Error {
    constructor(readonly code = 'independent_payment_refused') {
      super(code);
      this.name = 'IndependentInstructorPaymentError';
    }
  },
}));
vi.mock('@/lib/payments/origin', () => ({
  resolveOrigin: () => 'https://www.drivelinkup.com',
}));
vi.mock('@/lib/scheduling/listing-eligibility', () => ({
  loadListingEligibilityFacts: async (input: {
    listingCategories: string[];
    category: string;
  }) => ({
    categoryAllowed: input.listingCategories.includes(input.category),
    licenceStatus: 'VERIFIED',
    instructorAffiliated: true,
  }),
}));
vi.mock('@/lib/signup-resume', () => ({
  resolveLearnerBookingGate: async () => ({ eligible: true, state: 'ACTIVE' }),
}));

import { POST } from '@/app/api/bookings/[id]/accept/route';

function acceptRequest(body: unknown) {
  return new Request('http://localhost/api/bookings/booking_1/accept', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ctx = { params: Promise.resolve({ id: 'booking_1' }) };

beforeEach(() => {
  mockBookingFindUnique.mockReset();
  mockBookingUpdateMany.mockReset();
  mockInstructorFindUnique.mockReset();
  mockSlotUpdateMany.mockReset();
  mockCreateCheckout.mockClear();
  mockAuthzEvents.mockReset();
  mockAuthzEvents.mockResolvedValue([
    {
      sequence: 1,
      kind: 'grant',
      scopes: ['request_to_book'],
      decisionVersion: 1,
      actorUserId: 'rep-1',
      evidenceRef: 'ev',
      note: null,
      idempotencyKey: 'g1',
      createdAt: new Date('2026-10-23T00:00:00.000Z'),
      listingId: 'inst_1',
    },
  ]);
  delete process.env.SCHOOL_AUTHZ_ENFORCEMENT;
  vi.stubEnv('BOOKING_CREATION_ENABLED', 'true');
});

describe('POST /api/bookings/[id]/accept policy', () => {
  it('SC-16 re-checks E1 and does not reserve a slot when the category is not offered', async () => {
    mockBookingFindUnique.mockResolvedValueOnce({
      id: 'booking_1',
      instructorId: 'inst_1',
      paymentStatus: 'awaiting_approval',
      category: 'B',
      slotId: 'slot_1',
      actionToken: 'stored',
      userId: 'learner_1',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      preferredAt: new Date('2026-11-02T09:00:00.000Z'),
      locale: 'sv',
    });
    mockInstructorFindUnique.mockResolvedValueOnce({
      id: 'inst_1',
      name: 'School',
      email: null,
      city: 'Stockholm',
      userId: 'owner_1',
      hourlyRateSek: 500,
      bookingMode: 'request',
      categories: ['A'],
    });

    const res = await POST(acceptRequest({ token: 'stored', acceptedByLabel: 'School desk' }), ctx);

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { component: 'E1' } });
    expect(mockSlotUpdateMany).not.toHaveBeenCalled();
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });

  it('SC-16 accepts on external_manual without claiming a native slot', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking_1',
      instructorId: 'inst_1',
      paymentStatus: 'awaiting_approval',
      category: 'B',
      slotId: null,
      actionToken: 'stored',
      userId: 'learner_1',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      preferredAt: new Date('2026-11-02T09:00:00.000Z'),
      locale: 'sv',
      priceAmountSek: 500,
      serviceFeeSek: 0,
      grossChargedSek: 500,
    });
    mockInstructorFindUnique.mockResolvedValue({
      id: 'inst_1',
      name: 'School',
      email: null,
      city: 'Stockholm',
      userId: 'owner_1',
      hourlyRateSek: 500,
      bookingMode: 'request',
      categories: ['B'],
    });
    mockBookingUpdateMany.mockResolvedValue({ count: 1 });

    const res = await POST(
      acceptRequest({
        token: 'stored',
        acceptedByLabel: 'School desk',
        commitmentRoute: 'external_manual',
      }),
      ctx,
    );

    expect(res.status).toBe(200);
    expect(mockSlotUpdateMany).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ commitmentRoute: 'external_manual' }),
      }),
    );
    expect(mockCreateCheckout).toHaveBeenCalledOnce();
  });

  it('blocks acceptance after request_to_book withdrawal while enforcement is OFF', async () => {
    mockAuthzEvents.mockResolvedValue([
      {
        sequence: 1,
        kind: 'withdraw',
        scopes: ['request_to_book'],
        decisionVersion: 1,
        actorUserId: 'rep-1',
        evidenceRef: 'ev',
        note: null,
        idempotencyKey: 'w1',
        createdAt: new Date('2026-10-26T00:00:00.000Z'),
        listingId: 'inst_1',
      },
    ]);
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking_1',
      instructorId: 'inst_1',
      paymentStatus: 'awaiting_approval',
      category: 'B',
      slotId: null,
      actionToken: 'stored',
      userId: 'learner_1',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      preferredAt: new Date('2026-11-02T09:00:00.000Z'),
      locale: 'sv',
    });
    mockInstructorFindUnique.mockResolvedValue({
      id: 'inst_1',
      name: 'School',
      email: null,
      city: 'Stockholm',
      userId: 'owner_1',
      hourlyRateSek: 500,
      bookingMode: 'request',
      categories: ['B'],
    });

    const res = await POST(
      acceptRequest({
        token: 'stored',
        acceptedByLabel: 'School desk',
        commitmentRoute: 'external_manual',
      }),
      ctx,
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'not_authorized_by_school' } });
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
  });

  it('SC-16 keeps the request pending when no commitment route is recorded', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking_1',
      instructorId: 'inst_1',
      paymentStatus: 'awaiting_approval',
      category: 'B',
      slotId: 'slot_1',
      actionToken: 'stored',
      userId: 'learner_1',
      studentName: 'Ada',
      studentEmail: 'ada@example.test',
      preferredAt: new Date('2026-11-02T09:00:00.000Z'),
      locale: 'sv',
    });
    mockInstructorFindUnique.mockResolvedValue({
      id: 'inst_1',
      name: 'School',
      email: null,
      city: 'Stockholm',
      userId: 'owner_1',
      hourlyRateSek: 500,
      bookingMode: 'request',
      categories: ['B'],
      providerRole: 'SCHOOL',
    });

    const res = await POST(acceptRequest({ token: 'stored', acceptedByLabel: 'School desk' }), ctx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'booking_1',
      paymentStatus: 'awaiting_approval',
      actionUrl: null,
    });
    expect(mockSlotUpdateMany).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });
});
