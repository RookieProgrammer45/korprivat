import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  bookingFind: vi.fn(),
  bookingUpdate: vi.fn(),
  instructorFind: vi.fn(),
  slotUpdate: vi.fn(),
  stripeCreate: vi.fn(),
  stripeRetrieve: vi.fn(),
  stripeExpire: vi.fn(),
  reconcile: vi.fn(),
  getSessionUser: vi.fn(),
  assertTokenMatches: vi.fn(),
  generateBookingToken: vi.fn(),
  generateLearnerAccessToken: vi.fn(),
  resolveOrigin: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: m.bookingFind, updateMany: m.bookingUpdate },
    instructor: { findUnique: m.instructorFind },
    availabilitySlot: { updateMany: m.slotUpdate },
  },
}));
vi.mock('@/lib/business/booking-access', () => ({
  generateLearnerAccessToken: m.generateLearnerAccessToken,
}));
vi.mock('@/lib/business/booking-fees', () => ({
  learnerTotalSek: () => ({ priceSek: 550, serviceFeeSek: 0, totalSek: 550 }),
}));
vi.mock('@/lib/business/escrow', () => ({
  assertTokenMatches: m.assertTokenMatches,
  generateBookingToken: m.generateBookingToken,
}));
vi.mock('@/lib/business/provider-ownership', () => ({
  ProviderOwnershipError: class ProviderOwnershipError extends Error {},
  resolveOwnedProvider: vi.fn(),
}));
vi.mock('@/lib/business/provider-timezone', () => ({
  formatProviderDate: () => '2030-01-01 10:00',
  providerTimezoneForCity: () => 'Europe/Stockholm',
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/email/templates', () => ({
  bookingRequestApprovedEmail: vi.fn(),
  bookingRequestApprovedInstructorCopyEmail: vi.fn(),
}));
vi.mock('@/lib/payments/origin', () => ({ resolveOrigin: m.resolveOrigin }));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({
    checkout: {
      sessions: {
        create: m.stripeCreate,
        retrieve: m.stripeRetrieve,
        expire: m.stripeExpire,
      },
    },
  }),
}));
vi.mock('@/lib/payments/refunds', () => ({ reconcileCancelledCheckoutCapture: m.reconcile }));
vi.mock('@/lib/require-auth', () => ({ getSessionUser: m.getSessionUser }));

import { POST } from '@/app/api/bookings/[id]/accept/route';

const bookingId = 'booking_request';
type Row = Record<string, unknown>;
let current: Row;
let slot: Row;
let issuerInputStatuses: unknown[];

function matchesWhere(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') {
      return (expected as Record<string, unknown>[]).some((alternative) =>
        matchesWhere(row, alternative),
      );
    }
    const actual = row[key];
    if (expected instanceof Date)
      return actual instanceof Date && actual.getTime() === expected.getTime();
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const condition = expected as Record<string, unknown>;
      if ('in' in condition) return (condition.in as unknown[]).includes(actual);
      if ('gt' in condition) return actual instanceof Date && actual > (condition.gt as Date);
    }
    return actual === expected;
  });
}

function request() {
  return new Request(`https://app.test/api/bookings/${bookingId}/accept`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token: 'provider-action', acceptedByLabel: 'Provider' }),
  });
}

function configureStore(afterAcceptance?: Row) {
  m.bookingFind.mockImplementation(async (args: { include?: unknown }) => {
    if (args.include) issuerInputStatuses.push(current.paymentStatus);
    return { ...current, bookedSlot: { ...(current.bookedSlot as Row) } };
  });
  m.bookingUpdate.mockImplementation(async (args: { where: Row; data: Row }) => {
    if (!matchesWhere(current, args.where)) return { count: 0 };
    Object.assign(current, args.data);
    if (args.data.paymentStatus === 'unpaid' && afterAcceptance)
      Object.assign(current, afterAcceptance);
    return { count: 1 };
  });
  m.slotUpdate.mockImplementation(async (args: { where: Row; data: Row }) => {
    if (!matchesWhere(slot, args.where)) return { count: 0 };
    Object.assign(slot, args.data);
    return { count: 1 };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_only';
  current = {
    id: bookingId,
    instructorId: 'instructor_1',
    userId: 'learner_1',
    paymentStatus: 'awaiting_approval',
    cancellationOutcome: null,
    paidAt: null,
    heldAt: null,
    stripeSessionId: null,
    stripeCheckoutSessionId: null,
    slotId: 'slot_1',
    actionToken: 'provider-action',
    learnerAccessTokenHash: null,
    acceptedByLabel: null,
    acceptedAt: null,
    priceAmountSek: 550,
    serviceFeeSek: 0,
    grossChargedSek: 550,
    cancellationPolicyTier: 'moderate',
    locale: 'en',
    studentName: 'Learner',
    studentEmail: null,
    category: 'B',
    preferredAt: new Date('2030-01-01T10:00:00.000Z'),
    bookedSlot: { durationMinutes: 60 },
  };
  slot = {
    id: 'slot_1',
    instructorId: 'instructor_1',
    startsAt: new Date('2030-01-01T10:00:00.000Z'),
    bookedAt: null,
    bookedBookingId: null,
  };
  issuerInputStatuses = [];
  configureStore();
  m.instructorFind.mockResolvedValue({
    id: 'instructor_1',
    userId: 'provider_user',
    name: 'Provider',
    email: null,
    city: 'Malmö',
    hourlyRateSek: 550,
  });
  m.getSessionUser.mockResolvedValue(null);
  m.assertTokenMatches.mockReturnValue(true);
  m.generateBookingToken.mockReturnValue('new-provider-action');
  m.generateLearnerAccessToken.mockReturnValue({
    token: 'learner-token',
    tokenHash: 'learner-hash',
  });
  m.resolveOrigin.mockReturnValue('https://app.test');
  m.stripeCreate.mockResolvedValue({ id: 'cs_approved', url: 'https://checkout.test/cs_approved' });
  m.stripeRetrieve.mockResolvedValue({ status: 'open', payment_status: 'unpaid' });
  m.stripeExpire.mockResolvedValue({ status: 'expired' });
  m.reconcile.mockResolvedValue({ kind: 'skipped', reason: 'not_captured' });
});

afterEach(() => {
  delete process.env.STRIPE_SECRET_KEY;
});

describe('POST /api/bookings/[id]/accept reliability', () => {
  it('moves an approved request into the shared issuer payable protocol before Checkout issuance', async () => {
    const response = await POST(request(), { params: Promise.resolve({ id: bookingId }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      id: bookingId,
      paymentStatus: 'pending',
      actionUrl: 'https://app.test/bookings/booking_request?token=learner-token',
    });
    expect(issuerInputStatuses).toEqual(['unpaid']);
    expect(m.bookingUpdate.mock.calls[0]?.[0]).toMatchObject({
      where: expect.objectContaining({
        paymentStatus: 'awaiting_approval',
        cancellationOutcome: null,
        paidAt: null,
        stripeSessionId: null,
        stripeCheckoutSessionId: null,
      }),
      data: expect.objectContaining({ paymentStatus: 'unpaid' }),
    });
    expect(m.stripeCreate).toHaveBeenCalledOnce();
    expect(current).toMatchObject({
      paymentStatus: 'pending',
      stripeSessionId: 'cs_approved',
      stripeCheckoutSessionId: 'cs_approved',
    });
    expect(slot).toMatchObject({ bookedBookingId: bookingId });
  });

  it('rolls back and frees the slot only for missing Stripe configuration while its exact pre-issuance state remains owned', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const response = await POST(request(), { params: Promise.resolve({ id: bookingId }) });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ errors: { payments: 'not_enabled' } });
    expect(current).toMatchObject({
      paymentStatus: 'awaiting_approval',
      stripeSessionId: null,
      stripeCheckoutSessionId: null,
    });
    expect(m.bookingUpdate.mock.calls[1]?.[0]).toEqual({
      where: {
        id: bookingId,
        paymentStatus: 'unpaid',
        cancellationOutcome: null,
        paidAt: null,
        stripeSessionId: null,
        stripeCheckoutSessionId: null,
      },
      data: { paymentStatus: 'awaiting_approval' },
    });
    expect(m.slotUpdate).toHaveBeenCalledTimes(2);
    expect(slot).toMatchObject({ bookedAt: null, bookedBookingId: null });
  });

  it.each([
    {
      label: 'cancellation',
      winningState: { paymentStatus: 'cancelled_late', cancellationOutcome: 'cancelled_late' },
    },
    {
      label: 'payment',
      winningState: { paymentStatus: 'paid', paidAt: new Date('2030-01-01T09:59:00.000Z') },
    },
  ])(
    'does not reset or free a slot when $label wins while configuration failure is handled',
    async ({ winningState }) => {
      delete process.env.STRIPE_SECRET_KEY;
      configureStore(winningState);

      const response = await POST(request(), { params: Promise.resolve({ id: bookingId }) });

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({
        errors: { payments: 'checkout_recovery_required' },
      });
      expect(current).toMatchObject(winningState);
      expect(m.slotUpdate).toHaveBeenCalledOnce();
      expect(slot).toMatchObject({ bookedBookingId: bookingId });
      expect(m.bookingUpdate.mock.calls[1]?.[0].where).toMatchObject({
        paymentStatus: 'unpaid',
        cancellationOutcome: null,
        paidAt: null,
        stripeSessionId: null,
        stripeCheckoutSessionId: null,
      });
    },
  );

  it('retains the durable issuance claim and reservation after an ambiguous Stripe failure', async () => {
    m.stripeCreate.mockRejectedValueOnce(new Error('connection interrupted'));

    const response = await POST(request(), { params: Promise.resolve({ id: bookingId }) });

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      errors: { payments: 'checkout_recovery_required' },
    });
    expect(current.paymentStatus).toBe('pending');
    expect(current.stripeSessionId).toBeNull();
    expect(current.stripeCheckoutSessionId).toMatch(/^dlu_checkout_/);
    expect(m.bookingUpdate).toHaveBeenCalledTimes(2);
    expect(m.slotUpdate).toHaveBeenCalledOnce();
    expect(slot).toMatchObject({ bookedBookingId: bookingId });
  });
});
