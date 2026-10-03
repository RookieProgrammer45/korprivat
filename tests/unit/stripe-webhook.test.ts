import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Stripe from 'stripe';

const {
  mockBookingFindUnique,
  mockBookingUpdateMany,
  mockInstructorFindUnique,
  mockEnsureBookingReceipts,
  mockStripeWebhookEventCreate,
} = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockEnsureBookingReceipts: vi.fn(async () => undefined),
  mockStripeWebhookEventCreate: vi.fn(async () => ({ id: 'swe_1' })),
}));

vi.mock('server-only', () => ({}));

vi.mock('next/server', async () => {
  const { NextResponse } = await import('next/dist/server/web/exports');
  return {
    NextResponse,
    after: (task: (() => unknown) | Promise<unknown>) => {
      if (typeof task === 'function') {
        void Promise.resolve().then(() => task());
      } else {
        void task;
      }
    },
  };
});

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findUnique: mockBookingFindUnique,
      updateMany: mockBookingUpdateMany,
    },
    instructor: {
      findUnique: mockInstructorFindUnique,
    },
    stripeWebhookEvent: {
      create: mockStripeWebhookEventCreate,
    },
  },
}));

vi.mock('@/lib/business/receipts', () => ({
  ensureBookingReceipts: mockEnsureBookingReceipts,
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

const WEBHOOK_SECRET = 'whsec_test_stripe_webhook_secret';

function checkoutCompletedEvent(bookingId: string, sessionId = 'cs_test_1') {
  return {
    id: 'evt_test_1',
    object: 'event',
    api_version: '2026-08-26.dahlia',
    created: Math.floor(Date.now() / 1000),
    type: 'checkout.session.completed',
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: 'checkout.session',
        amount_total: 45000,
        currency: 'sek',
        metadata: { bookingId },
        payment_status: 'paid',
        status: 'complete',
      },
    },
  };
}

function signedRequest(event: unknown, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    body: payload,
  });
}

beforeEach(() => {
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.STRIPE_SECRET_KEY = 'sk_test_webhook_unit';
  mockBookingFindUnique.mockReset();
  mockBookingUpdateMany.mockReset();
  mockInstructorFindUnique.mockReset();
  mockEnsureBookingReceipts.mockReset();
  mockEnsureBookingReceipts.mockResolvedValue(undefined);
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe('POST /api/webhooks/stripe', () => {
  it('marks unpaid booking paid on checkout.session.completed', async () => {
    const bookingId = 'booking_paid_1';
    mockBookingFindUnique
      .mockResolvedValueOnce({ id: bookingId, paidAt: null })
      .mockResolvedValueOnce({
        id: bookingId,
        instructorId: 'inst_1',
        bookedSlot: { startsAt: new Date(), durationMinutes: 60 },
      });
    mockBookingUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockInstructorFindUnique.mockResolvedValueOnce({
      name: 'Test Instructor',
      city: 'Malmö',
      hourlyRateSek: 450,
    });

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, duplicate: false });
    expect(mockBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: bookingId, paidAt: null }),
        data: expect.objectContaining({
          stripeSessionId: 'cs_test_1',
          paymentStatus: 'held_escrow',
        }),
      }),
    );
  });

  it('returns duplicate when booking already paid', async () => {
    const bookingId = 'booking_dup_1';
    mockBookingFindUnique.mockResolvedValueOnce({
      id: bookingId,
      paidAt: new Date('2026-01-01T00:00:00Z'),
    });

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, duplicate: true });
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
  });

  it('returns ignored when bookingId is unknown', async () => {
    mockBookingFindUnique.mockResolvedValueOnce(null);

    const res = await POST(signedRequest(checkoutCompletedEvent('booking_missing')));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 401 on invalid signature', async () => {
    const payload = JSON.stringify(checkoutCompletedEvent('booking_x'));
    const badSig = Stripe.webhooks.generateTestHeaderString({
      payload,
      secret: 'whsec_wrong_secret_value_xxxxx',
    });
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': badSig,
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('returns 401 when signature header is missing', async () => {
    const payload = JSON.stringify(checkoutCompletedEvent('booking_x'));
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'missing_signature' });
  });

  it('acks unrelated event types without DB write', async () => {
    const event = {
      ...checkoutCompletedEvent('booking_x'),
      type: 'payment_intent.succeeded',
    };
    const res = await POST(signedRequest(event));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ received: true });
    expect(mockBookingFindUnique).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
  });

  it('returns 503 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const payload = JSON.stringify(checkoutCompletedEvent('booking_x'));
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'stripe-signature': 't=1,v1=abc',
      },
      body: payload,
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'webhook_not_configured' });
  });
});
