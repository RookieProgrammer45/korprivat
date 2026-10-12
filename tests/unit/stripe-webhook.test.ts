import Stripe from 'stripe';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBookingFindUnique,
  mockBookingUpdateMany,
  mockInstructorFindUnique,
  mockEnsureBookingReceipts,
  mockStripeWebhookEventCreate,
  mockCancelledCaptureReconcile,
} = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockEnsureBookingReceipts: vi.fn(async () => undefined),
  mockStripeWebhookEventCreate: vi.fn(async () => ({ id: 'swe_1' })),
  mockCancelledCaptureReconcile: vi.fn(async () => ({
    kind: 'refunded',
    refundId: 're_1',
    amountSek: 550,
  })),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/server', async () => {
  const { NextResponse } = await import('next/dist/server/web/exports');
  return {
    NextResponse,
    after: (task: (() => unknown) | Promise<unknown>) => {
      if (typeof task === 'function') void Promise.resolve().then(() => task());
      else void task;
    },
  };
});
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique, updateMany: mockBookingUpdateMany },
    instructor: { findUnique: mockInstructorFindUnique },
    stripeWebhookEvent: { create: mockStripeWebhookEventCreate },
  },
}));
vi.mock('@/lib/business/receipts', () => ({ ensureBookingReceipts: mockEnsureBookingReceipts }));
vi.mock('@/lib/payments/refunds', () => ({
  reconcileCancelledCheckoutCapture: mockCancelledCaptureReconcile,
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn(async () => ({ id: 'mock-email' })) }));
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
const bookingBase = (id: string) => ({
  id,
  instructorId: 'inst_1',
  studentName: 'Learner',
  studentEmail: 'learner@example.test',
  locale: 'sv',
  grossChargedSek: 550,
  paymentStatus: 'pending',
  cancellationOutcome: null,
  cancellationPolicyTier: 'flexible',
  paidAt: null,
  heldAt: null,
  stripeSessionId: 'cs_test_1',
  stripeCheckoutSessionId: 'cs_test_1',
  bookedSlot: { startsAt: new Date(), durationMinutes: 60 },
});

function checkoutCompletedEvent(
  bookingId: string,
  sessionId = 'cs_test_1',
  session: Partial<Record<'amount_total' | 'currency' | 'payment_status' | 'status', unknown>> = {},
) {
  return {
    id: `evt_${bookingId}_${String(session.currency ?? 'sek')}_${String(session.payment_status ?? 'paid')}`,
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
        amount_total: 55000,
        currency: 'sek',
        metadata: { bookingId },
        payment_status: 'paid',
        status: 'complete',
        ...session,
      },
    },
  };
}

function signedRequest(event: unknown, secret = WEBHOOK_SECRET): Request {
  const payload = JSON.stringify(event);
  const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
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
  mockStripeWebhookEventCreate.mockReset();
  mockCancelledCaptureReconcile.mockReset();
  mockEnsureBookingReceipts.mockResolvedValue(undefined);
  mockStripeWebhookEventCreate.mockResolvedValue({ id: 'swe_1' });
  mockCancelledCaptureReconcile.mockResolvedValue({
    kind: 'refunded',
    refundId: 're_1',
    amountSek: 550,
  });
});

afterEach(() => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
});

describe('POST /api/webhooks/stripe', () => {
  it('marks an exactly-matching paid SEK checkout held and gives receipts the same SEK amount', async () => {
    const bookingId = 'booking_paid_1';
    mockBookingFindUnique
      .mockResolvedValueOnce(bookingBase(bookingId)) // validation read
      .mockResolvedValueOnce(bookingBase(bookingId)) // fulfillment CAS read
      .mockResolvedValueOnce({
        ...bookingBase(bookingId),
        paymentStatus: 'held_escrow',
        paidAt: new Date(),
      });
    mockBookingUpdateMany.mockResolvedValueOnce({ count: 1 });
    mockInstructorFindUnique.mockResolvedValueOnce({
      name: 'Test Instructor',
      city: 'Malmö',
      hourlyRateSek: 550,
    });

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId)));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, duplicate: false });
    expect(mockBookingUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: bookingId, paidAt: null, cancellationOutcome: null }),
        data: expect.objectContaining({
          stripeSessionId: 'cs_test_1',
          paymentStatus: 'held_escrow',
        }),
      }),
    );
    expect(mockEnsureBookingReceipts).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedAmountSek: 550 }),
    );
    expect(mockStripeWebhookEventCreate).toHaveBeenCalledOnce();
  });

  it('returns duplicate when an exactly-matching checkout was already paid while still repairing receipt snapshots', async () => {
    const bookingId = 'booking_dup_1';
    const paid = {
      ...bookingBase(bookingId),
      paidAt: new Date('2026-01-01T00:00:00Z'),
      paymentStatus: 'held_escrow',
    };
    mockBookingFindUnique
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(paid);
    mockInstructorFindUnique.mockResolvedValueOnce({
      name: 'Test Instructor',
      city: 'Malmö',
      hourlyRateSek: 550,
    });

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, duplicate: true });
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockEnsureBookingReceipts).toHaveBeenCalledWith(
      expect.objectContaining({ verifiedAmountSek: 550 }),
    );
  });

  it.each([
    ['invalid currency', { currency: 'usd' }],
    ['mismatched amount', { amount_total: 54900 }],
    ['unpaid completed session', { payment_status: 'unpaid', status: 'complete' }],
  ])('does not fulfill or claim a %s checkout event', async (_label, session) => {
    const bookingId = `booking_invalid_${String(_label).replaceAll(' ', '_')}`;
    mockBookingFindUnique.mockResolvedValueOnce(bookingBase(bookingId));

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId, 'cs_test_1', session)));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual(
      expect.objectContaining({ error: 'checkout_validation_failed' }),
    );
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockEnsureBookingReceipts).not.toHaveBeenCalled();
    expect(mockStripeWebhookEventCreate).not.toHaveBeenCalled();
  });

  it('reconciles a paid checkout that loses the fulfillment CAS to cancellation instead of treating it as duplicate', async () => {
    const bookingId = 'booking_cancelled_capture';
    const cancelled = {
      ...bookingBase(bookingId),
      paymentStatus: 'cancelled_late',
      cancellationOutcome: 'cancelled_late',
      paidAt: null,
      heldAt: null,
    };
    mockBookingFindUnique
      .mockResolvedValueOnce(bookingBase(bookingId))
      .mockResolvedValueOnce(bookingBase(bookingId))
      .mockResolvedValueOnce(cancelled);
    mockBookingUpdateMany.mockResolvedValueOnce({ count: 0 });

    const res = await POST(signedRequest(checkoutCompletedEvent(bookingId)));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, cancelled: true, reconciled: 'refunded' });
    expect(mockCancelledCaptureReconcile).toHaveBeenCalledWith(
      expect.objectContaining({ bookingId, sessionId: 'cs_test_1', forceFullRefund: true }),
    );
    expect(mockBookingUpdateMany).toHaveBeenCalledOnce();
    expect(mockEnsureBookingReceipts).not.toHaveBeenCalled();
  });

  it('returns ignored when bookingId is unknown', async () => {
    mockBookingFindUnique.mockResolvedValueOnce(null);
    const res = await POST(signedRequest(checkoutCompletedEvent('booking_missing')));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, ignored: true });
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
      headers: { 'content-type': 'application/json', 'stripe-signature': badSig },
      body: payload,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'invalid_signature' });
  });

  it('returns 401 when signature header is missing', async () => {
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(checkoutCompletedEvent('booking_x')),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'missing_signature' });
  });

  it('acks unrelated event types after recording their successful delivery', async () => {
    const event = { ...checkoutCompletedEvent('booking_x'), type: 'payment_intent.succeeded' };
    const res = await POST(signedRequest(event));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(mockBookingFindUnique).not.toHaveBeenCalled();
    expect(mockBookingUpdateMany).not.toHaveBeenCalled();
    expect(mockStripeWebhookEventCreate).toHaveBeenCalledOnce();
  });

  it('returns 503 when STRIPE_WEBHOOK_SECRET is missing', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=abc' },
      body: JSON.stringify(checkoutCompletedEvent('booking_x')),
    });
    const res = await POST(req);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: 'webhook_not_configured' });
  });
});
