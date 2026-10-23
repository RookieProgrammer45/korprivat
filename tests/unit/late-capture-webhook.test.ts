import Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBookingFindUnique,
  mockBookingUpdateMany,
  mockTransitionFindFirst,
  mockPaymentCreate,
  mockOpsCreate,
  mockMarkPaid,
} = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockTransitionFindFirst: vi.fn(),
  mockPaymentCreate: vi.fn(async () => ({ id: 'pay_1' })),
  mockOpsCreate: vi.fn(async () => ({ id: 'ops_1' })),
  mockMarkPaid: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async () => {
  const { NextResponse } = await import('next/dist/server/web/exports');
  return { NextResponse, after: () => undefined };
});
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique, updateMany: mockBookingUpdateMany },
    bookingStateTransition: { findFirst: mockTransitionFindFirst },
    paymentRecord: { create: mockPaymentCreate },
    opsTask: { create: mockOpsCreate },
    stripeWebhookEvent: { create: vi.fn(async () => ({ id: 'swe_1' })) },
  },
}));
vi.mock('@/lib/payments/fulfill-checkout', () => ({
  markBookingPaidFromCheckout: mockMarkPaid,
}));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({
    webhooks: {
      constructEvent: (rawBody: string, signature: string, secret: string) =>
        Stripe.webhooks.constructEvent(rawBody, signature, secret),
    },
  }),
}));

import { POST } from '@/app/api/webhooks/stripe/route';

const SECRET = 'whsec_test_late_capture';

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_late_capture';
  mockBookingFindUnique.mockReset();
  mockBookingUpdateMany.mockReset();
  mockTransitionFindFirst.mockReset();
  mockPaymentCreate.mockClear();
  mockOpsCreate.mockClear();
  mockMarkPaid.mockReset();
});

describe('POST /api/webhooks/stripe late capture', () => {
  it('SC-15 records a late capture and does not confirm an expired booking', async () => {
    mockBookingFindUnique.mockResolvedValue({ id: 'booking_expired', paymentStatus: 'unpaid' });
    mockTransitionFindFirst.mockResolvedValue({ toState: 'expired' });

    const event = {
      id: 'evt_late_1',
      object: 'event',
      api_version: '2026-08-26.dahlia',
      created: Math.floor(Date.now() / 1000),
      type: 'checkout.session.completed',
      livemode: false,
      pending_webhooks: 1,
      request: { id: null, idempotency_key: null },
      data: {
        object: {
          id: 'cs_late_1',
          object: 'checkout.session',
          amount_total: 45000,
          currency: 'sek',
          metadata: { bookingId: 'booking_expired' },
          payment_status: 'paid',
          status: 'complete',
        },
      },
    };
    const payload = JSON.stringify(event);
    const res = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'stripe-signature': Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET }),
        },
        body: payload,
      }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, lateCaptured: true });
    expect(mockMarkPaid).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockPaymentCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lateCaptured: true, state: 'captured' }),
      }),
    );
    expect(mockOpsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ allowedActions: ['void_refund', 'new_booking'] }),
      }),
    );
  });
});
