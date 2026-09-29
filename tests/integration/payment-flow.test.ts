//
// Payment rail:
//   POST /api/checkout  → mints Stripe Checkout session (SEK),
//                         persists stripeSessionId, flips status to pending.
//   GET  /api/bookings/[id]/payment-poll → reads paidAt or retrieves session;
//                         on first paid flips pending → held_escrow.

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';

import { vi } from 'vitest';

const createCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));
vi.mock('stripe', () => {
  class StripeMock {
    checkout = {
      sessions: {
        create: (...args: unknown[]) => createCheckoutSession(...args),
        retrieve: (...args: unknown[]) => retrieveCheckoutSession(...args),
      },
    };
    webhooks = { constructEvent: vi.fn() };
    constructor(_key: string, _opts?: unknown) {}
  }
  return { default: StripeMock };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as checkoutPOST } from '@/app/api/checkout/route';
import { GET as paymentPollGET } from '@/app/api/bookings/[id]/payment-poll/route';
import { BookingPaymentLinkResponse, BookingPaymentPollResponse } from '@/lib/contracts/bookings';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';
import {
  bookingRow,
  instructorRow,
  prismaMock,
  resetPrisma,
  TEST_LEARNER_ACCESS_TOKEN,
} from './_setup/prisma-mock';

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
  createCheckoutSession.mockReset();
  retrieveCheckoutSession.mockReset();
  process.env.STRIPE_SECRET_KEY = 'sk_test_integration';
  createCheckoutSession.mockResolvedValue({
    id: 'cs_test_abc',
    url: 'https://checkout.stripe.com/c/pay/cs_test_abc',
  });
  retrieveCheckoutSession.mockResolvedValue({
    id: 'cs_test_abc',
    payment_status: 'unpaid',
    status: 'open',
  });
});

afterEach(() => {
  createCheckoutSession.mockReset();
  retrieveCheckoutSession.mockReset();
});

function checkoutReq(bookingId: string, token = TEST_LEARNER_ACCESS_TOKEN): Request {
  return new Request('http://localhost/api/checkout', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ bookingId, token }),
  });
}

function learnerGet(url: string): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

describe('POST /api/checkout', () => {
  it('mints a Checkout Session in SEK and persists stripeSessionId', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(bookingRow({ id: 'booking_pay', paymentStatus: null }));
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ hourlyRateSek: 550 }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking_pay' });

    const res = await checkoutPOST(checkoutReq('booking_pay'));
    expect(res.status).toBe(200);
    const parsed = BookingPaymentLinkResponse.parse((await res.json()) as unknown);
    expect(parsed.url).toContain('checkout.stripe.com');
    expect(parsed.paymentStatus).toBe('pending');

    expect(createCheckoutSession).toHaveBeenCalledOnce();
    const arg = createCheckoutSession.mock.calls[0]?.[0] as {
      mode: string;
      line_items: Array<{ price_data: { currency: string; unit_amount: number } }>;
      metadata: { bookingId: string; priceSek: string };
    };
    expect(arg.mode).toBe('payment');
    expect(arg.line_items[0]?.price_data.currency).toBe('sek');
    expect(arg.line_items[0]?.price_data.unit_amount).toBe(55000);
    expect(arg.metadata.bookingId).toBe('booking_pay');
    expect(arg.metadata.priceSek).toBe('550');

    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_pay' },
        data: expect.objectContaining({
          paymentStatus: 'pending',
          stripeSessionId: 'cs_test_abc',
          stripeCheckoutSessionId: 'cs_test_abc',
          grossChargedSek: 550,
        }),
      }),
    );
  });

  it('returns url:null when already held_escrow (idempotent)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({ id: 'booking_already', paymentStatus: 'held_escrow', paidAt: new Date() }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());

    const res = await checkoutPOST(checkoutReq('booking_already'));
    expect(res.status).toBe(200);
    const parsed = BookingPaymentLinkResponse.parse((await res.json()) as unknown);
    expect(parsed.url).toBeNull();
    expect(parsed.paymentStatus).toBe('held_escrow');
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it('401 without session or token', async () => {
    const res = await checkoutPOST(
      new Request('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: 'booking_pay' }),
      }),
    );
    expect(res.status).toBe(401);
  });

  it('404 when booking missing', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);
    const res = await checkoutPOST(checkoutReq('missing'));
    expect(res.status).toBe(404);
  });

  it('403 when STRIPE_SECRET_KEY unset', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    prismaMock.booking.findUnique.mockResolvedValue(bookingRow({ id: 'booking_x' }));
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());
    const res = await checkoutPOST(checkoutReq('booking_x'));
    expect(res.status).toBe(403);
  });
});

describe('SEK → USD floor (sekToUsdChargeAmount)', () => {
  it('hourlyRateSek:1 → amountUsd:1', () => {
    expect(sekToUsdChargeAmount(1)).toBe(1);
  });
  it('hourlyRateSek:10 → amountUsd:1', () => {
    expect(sekToUsdChargeAmount(10)).toBe(1);
  });
  it('hourlyRateSek:11 → amountUsd:2', () => {
    expect(sekToUsdChargeAmount(11)).toBe(2);
  });
  it('hourlyRateSek:450 → amountUsd:43', () => {
    expect(sekToUsdChargeAmount(450)).toBe(43);
  });
  it('hourlyRateSek:550 → amountUsd:52', () => {
    expect(sekToUsdChargeAmount(550)).toBe(52);
  });
  it('throws on non-positive', () => {
    expect(() => sekToUsdChargeAmount(0)).toThrow();
    expect(() => sekToUsdChargeAmount(-1)).toThrow();
  });
});

describe('GET /api/bookings/[id]/payment-poll', () => {
  it('verified=false when Stripe session unpaid', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_pp1',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_test_xyz',
        stripeCheckoutSessionId: 'cs_test_xyz',
      }),
    );
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_test_xyz',
      payment_status: 'unpaid',
      status: 'open',
    });

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp1/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp1' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(false);
  });

  it('flips pending → held_escrow when Stripe says paid', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_pp2',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_test_ok',
        stripeCheckoutSessionId: 'cs_test_ok',
        preferredAt: new Date('2026-08-30T10:00:00.000Z'),
      }),
    );
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValue(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_test_ok',
      payment_status: 'paid',
      status: 'complete',
    });

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp2/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp2' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(true);
    expect(parsed.paymentStatus).toBe('held_escrow');
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'booking_pp2', paidAt: null }),
        data: expect.objectContaining({
          paymentStatus: 'held_escrow',
          paidAt: expect.any(Date),
          stripeSessionId: 'cs_test_ok',
        }),
      }),
    );
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it('second poll is idempotent when already held', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_pp3',
        paymentStatus: 'held_escrow',
        paidAt: new Date(),
        stripeSessionId: 'cs_test_done',
        stripeCheckoutSessionId: 'cs_test_done',
        actionToken: 'token_already',
        heldAt: new Date(),
      }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());
    prismaMock.bookingReceipt.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp3/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp3' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(true);
    expect(retrieveCheckoutSession).not.toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
  });

  it('no session id ⇒ verified=false without Stripe retrieve', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_pre',
        paymentStatus: 'unpaid',
        stripeSessionId: null,
        stripeCheckoutSessionId: null,
      }),
    );
    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pre/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pre' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(false);
    expect(retrieveCheckoutSession).not.toHaveBeenCalled();
  });
});
