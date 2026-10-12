import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  instructor: vi.fn(),
  create: vi.fn(),
  retrieve: vi.fn(),
  expire: vi.fn(),
  reconcile: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: m.find, updateMany: m.update },
    instructor: { findUnique: m.instructor },
  },
}));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({
    checkout: { sessions: { create: m.create, retrieve: m.retrieve, expire: m.expire } },
  }),
}));
vi.mock('@/lib/payments/refunds', () => ({ reconcileCancelledCheckoutCapture: m.reconcile }));

import { CHECKOUT_ISSUANCE_PREFIX } from '@/lib/payments/checkout-issuance';
import {
  CheckoutUnavailableError,
  createBookingCheckoutSession,
} from '@/lib/payments/create-booking-checkout';

const base = {
  id: 'booking',
  instructorId: 'provider',
  userId: 'learner',
  paymentStatus: 'unpaid',
  cancellationOutcome: null as string | null,
  paidAt: null,
  heldAt: null,
  priceAmountSek: 550,
  serviceFeeSek: 0,
  grossChargedSek: 550,
  stripeSessionId: null as string | null,
  stripeCheckoutSessionId: null as string | null,
  cancellationPolicyTier: 'moderate',
  bookedSlot: { durationMinutes: 90 },
};
const input = {
  bookingId: 'booking',
  req: new Request('https://www.drivelinkup.com/api/checkout'),
};
const session = { id: 'cs_new', url: 'https://checkout.example.test/cs_new' };
let current: typeof base;

beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock_only';
  current = { ...base };
  m.find.mockImplementation(async () => ({ ...current }));
  m.update.mockImplementation(
    async (args: { where: Record<string, unknown>; data: Partial<typeof base> }) => {
      if (current.cancellationOutcome || current.paymentStatus.startsWith('cancelled_'))
        return { count: 0 };
      Object.assign(current, args.data);
      return { count: 1 };
    },
  );
  m.instructor.mockResolvedValue({ id: 'provider', name: 'Provider', hourlyRateSek: 999 });
  m.create.mockResolvedValue(session);
  m.expire.mockResolvedValue({ status: 'expired' });
  m.reconcile.mockResolvedValue({ kind: 'skipped', reason: 'not_captured' });
});

describe('durable checkout issuance races', () => {
  it('expires a minted session when cancellation wins and never resurrects the booking', async () => {
    m.create.mockImplementationOnce(async () => {
      current = {
        ...current,
        paymentStatus: 'cancelled_late',
        cancellationOutcome: 'cancelled_late',
      };
      return session;
    });
    await expect(createBookingCheckoutSession(input)).rejects.toBeInstanceOf(
      CheckoutUnavailableError,
    );
    expect(current.paymentStatus).toBe('cancelled_late');
    expect(m.expire).toHaveBeenCalledOnce();
    expect(m.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId: 'booking', sessionId: 'cs_new', forceFullRefund: true }),
    );
    expect(m.update.mock.calls[1]?.[0].where).toMatchObject({
      paymentStatus: 'pending',
      cancellationOutcome: null,
    });
  });

  it('does not expire the active session when a same-claim sibling already persisted it', async () => {
    const claim = `${CHECKOUT_ISSUANCE_PREFIX}existing`;
    current = { ...base, paymentStatus: 'pending', stripeCheckoutSessionId: claim };
    m.update.mockImplementationOnce(async () => {
      current = { ...current, stripeSessionId: session.id, stripeCheckoutSessionId: session.id };
      return { count: 0 };
    });
    expect(await createBookingCheckoutSession(input)).toEqual({
      url: session.url,
      stripeSessionId: session.id,
    });
    expect(m.create.mock.calls[0]?.[1].idempotencyKey).toContain(claim.split(':')[0]);
    expect(m.expire).not.toHaveBeenCalled();
    expect(m.reconcile).not.toHaveBeenCalled();
  });

  it('replaces an expired session with a new persisted claim, then reuses its open replacement', async () => {
    current = {
      ...base,
      paymentStatus: 'pending',
      stripeSessionId: 'cs_expired',
      stripeCheckoutSessionId: 'cs_expired',
    };
    m.retrieve.mockImplementation(async (id: string) =>
      id === 'cs_expired'
        ? { status: 'expired', payment_status: 'unpaid' }
        : { ...session, status: 'open', payment_status: 'unpaid' },
    );
    expect(await createBookingCheckoutSession(input)).toEqual({
      url: session.url,
      stripeSessionId: session.id,
    });
    const claim = m.update.mock.calls[0]?.[0].data.stripeCheckoutSessionId as string;
    expect(claim.startsWith(CHECKOUT_ISSUANCE_PREFIX)).toBe(true);
    expect(m.create.mock.calls[0]?.[1].idempotencyKey).toContain(claim.split(':')[0]);
    expect(await createBookingCheckoutSession(input)).toEqual({
      url: session.url,
      stripeSessionId: session.id,
    });
    expect(m.create).toHaveBeenCalledOnce();
    expect(m.expire).not.toHaveBeenCalled();
  });

  it('retries an uncertain Stripe request using the same durable key and frozen amount', async () => {
    m.create
      .mockRejectedValueOnce(new Error('connection interrupted'))
      .mockResolvedValueOnce(session);
    await expect(createBookingCheckoutSession(input)).rejects.toThrow('connection interrupted');
    expect(current.stripeCheckoutSessionId?.startsWith(CHECKOUT_ISSUANCE_PREFIX)).toBe(true);
    await createBookingCheckoutSession(input);
    expect(m.create.mock.calls[0]?.[1]).toEqual(m.create.mock.calls[1]?.[1]);
    expect(m.create.mock.calls[1]?.[0].line_items[0].price_data).toMatchObject({
      currency: 'sek',
      unit_amount: 55000,
    });
    expect(m.update).toHaveBeenCalledTimes(2);
    expect(m.expire).not.toHaveBeenCalled();
  });
});
