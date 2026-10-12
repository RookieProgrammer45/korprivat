import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  instructor: vi.fn(),
  create: vi.fn(),
  expire: vi.fn(),
  reconcile: vi.fn(),
  fee: vi.fn(),
  free: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => {
  const db = {
    booking: { findUnique: m.find, updateMany: m.update },
    instructor: { findUnique: m.instructor },
    lateCancellationFee: { create: m.fee },
    availabilitySlot: { updateMany: m.free },
    bookingReceipt: { findMany: vi.fn(async () => []) },
  };
  return {
    prisma: { ...db, $transaction: async (cb: (tx: typeof db) => Promise<unknown>) => cb(db) },
  };
});
vi.mock('@/lib/require-auth', () => ({
  getSessionUser: async () => ({ id: 'learner', email: 'learner@example.test' }),
}));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: m.create, expire: m.expire } } }),
}));
vi.mock('@/lib/payments/refunds', () => ({
  reconcileCancelledCheckoutCapture: m.reconcile,
  alertReleasedCancelNeedsReview: vi.fn(),
}));
vi.mock('@/lib/business/receipts', () => ({
  repairPaidCancellationReceipts: vi.fn(async () => false),
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => ({ id: 'mock' })) }));

import { POST as cancel } from '@/app/api/bookings/[id]/cancel/route';
import {
  checkoutIssuanceIdempotencyKey,
  newCheckoutIssuanceClaim,
  readCheckoutIssuanceParams,
} from '@/lib/payments/checkout-issuance';
import { recoverCancelledCheckoutIssuance } from '@/lib/payments/checkout-issuance-recovery';
import { createBookingCheckoutSession } from '@/lib/payments/create-booking-checkout';

let state: Record<string, unknown>;
beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_SECRET_KEY = 'sk_mock';
  state = {
    id: 'b',
    instructorId: 'p',
    userId: 'learner',
    studentName: 'Learner',
    studentEmail: 'learner@example.test',
    preferredAt: new Date(Date.now() + 48 * 3600000),
    paymentStatus: 'unpaid',
    paidAt: null,
    heldAt: null,
    cancellationOutcome: null,
    cancelledAt: null,
    actionToken: null,
    learnerAccessTokenHash: null,
    grossChargedSek: 550,
    priceAmountSek: 550,
    serviceFeeSek: 0,
    cancellationPolicyTier: 'moderate',
    locale: 'en',
    stripeSessionId: null,
    stripeCheckoutSessionId: null,
    bookedSlot: { durationMinutes: 40 },
  };
  m.find.mockImplementation(async () => ({ ...state }));
  m.update.mockImplementation(async ({ data }) => {
    Object.assign(state, data);
    return { count: 1 };
  });
  m.instructor.mockResolvedValue({
    id: 'p',
    name: 'Provider',
    userId: 'provider',
    city: 'Stockholm',
    hourlyRateSek: 999,
    email: null,
  });
  m.create.mockResolvedValue({
    id: 'cs_recovered',
    url: 'https://checkout.example.test/c',
    status: 'open',
    payment_status: 'unpaid',
  });
  m.expire.mockResolvedValue({ status: 'expired' });
  m.reconcile.mockResolvedValue({ kind: 'skipped', reason: 'not_captured' });
  m.free.mockResolvedValue({ count: 1 });
});
const req = () => new Request('https://www.drivelinkup.com/api/checkout');
describe('durable cancelled issuance recovery', () => {
  it('recovers Stripe success after DB persistence failure, expires the real ID and never resurrects cancellation', async () => {
    let failPersistence = true;
    m.update.mockImplementation(async ({ data }) => {
      if (data.stripeSessionId === 'cs_recovered' && failPersistence) {
        failPersistence = false;
        throw new Error('database outage');
      }
      Object.assign(state, data);
      return { count: 1 };
    });
    await expect(createBookingCheckoutSession({ bookingId: 'b', req: req() })).rejects.toThrow(
      'database outage',
    );
    expect(state.stripeCheckoutSessionId).toEqual(expect.stringMatching(/^dlu_checkout_/));
    const original = m.create.mock.calls[0];
    state.locale = 'sv';
    const response = await cancel(
      new Request('https://drivelinkup-web.vercel.app/api/bookings/b/cancel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cancelledByLabel: 'Learner' }),
      }),
      { params: Promise.resolve({ id: 'b' }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reconciliationPending: false,
      feeAmountSek: 0,
      cancellationOutcome: 'cancelled_partial',
    });
    expect(m.create.mock.calls[1]).toEqual(original);
    expect(state.stripeSessionId).toBe('cs_recovered');
    expect(state.paymentStatus).toBe('cancelled_partial');
    expect(m.expire).toHaveBeenCalledWith('cs_recovered');
    expect(m.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'cs_recovered', forceFullRefund: true }),
    );
  });
  it('does not guess parameters or report an old opaque claim as completed', async () => {
    state.cancellationOutcome = 'cancelled_partial';
    state.stripeCheckoutSessionId = 'dlu_checkout_old-opaque';
    await expect(recoverCancelledCheckoutIssuance('b')).resolves.toBe('pending');
    expect(m.create).not.toHaveBeenCalled();
  });
  it('expires a recovered real session even if saving its ID fails again', async () => {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'sek',
            unit_amount: 55000,
            product_data: { name: 'Driving lesson' },
          },
        },
      ],
      success_url: 'https://www.drivelinkup.com/checkout/success',
      cancel_url: 'https://www.drivelinkup.com/checkout/cancelled',
      metadata: { bookingId: 'b', grossChargedSek: '550' },
    };
    state.cancellationOutcome = 'cancelled_partial';
    state.stripeCheckoutSessionId = newCheckoutIssuanceClaim(params);
    m.update.mockRejectedValueOnce(new Error('still unavailable'));
    await expect(recoverCancelledCheckoutIssuance('b')).rejects.toThrow('still unavailable');
    expect(m.expire).toHaveBeenCalledWith('cs_recovered');
    expect(state.stripeSessionId).toBeNull();
  });
  it('binds payloads to their booking and keeps the provider idempotency key shorter than 255 characters', () => {
    const params: Stripe.Checkout.SessionCreateParams = {
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'sek',
            unit_amount: 55000,
            product_data: { name: 'Driving lesson' },
          },
        },
      ],
      success_url: 'https://www.drivelinkup.com/checkout/success',
      cancel_url: 'https://www.drivelinkup.com/checkout/cancelled',
      metadata: { bookingId: 'b', grossChargedSek: '550' },
    };
    const claim = newCheckoutIssuanceClaim(params);
    expect(readCheckoutIssuanceParams(claim, 'b')).toMatchObject({ metadata: { bookingId: 'b' } });
    expect(readCheckoutIssuanceParams(claim, 'foreign')).toBeNull();
    expect(checkoutIssuanceIdempotencyKey('b', claim).length).toBeLessThan(255);
  });
});
