//
// The payment rail goes:
//   POST /api/bookings/[id]/payment-link  → mints Stripe Checkout session,
//                                           persists stripeCheckoutSessionId,
//                                           flips status to 'pending'.
//   GET  /api/bookings/[id]/payment-poll  → verifies with Stripe once;
//                                           on first verify flips 'pending'
//                                           → 'held_escrow' and gestures the
//                                           held-receipt emails.
//
// This file asserts both the wire format and the fulfill-once semantics.
// We mock globalThis.fetch so the stripe-billing client's `polsiaJson`
// path is exercised against a tiny canned router — the alternative
// (mocking `@/lib/stripe-billing/client` directly) would hide the wire
// envelope and miss regressions on the request body shape.
//
// Coverage:
//   1. POST /api/bookings/[id]/payment-link
//      a. unpaid → returns { url, paymentStatus: 'pending' } + persists
//         stripeCheckoutSessionId via update
//      b. already paid/held_escrow → { url: null, paymentStatus: <held> }
//         SHORT-CIRCUITS — does NOT mint another session (idempotency)
//      c. amountUsd is computed from hourlyRateSek through sekToUsdChargeAmount
//      d. SEK→USD floor: hourlyRateSek:50 yields amountUsd:1 (never below $1)
//
//   2. GET /api/bookings/[id]/payment-poll
//      a. unverified  → { verified: false, paymentStatus: 'pending' }
//      b. first verify → { verified: true, paymentStatus: 'held_escrow' }
//                        + updates row + emits 1-2 held-receipt emails
//      c. second call → idempotent: row is already held_escrow,
//                        no extra updates, no duplicate emails
//
// biome: this file is OUTSIDE the overrides' src/** glob. We do not import
// restricted paths directly; we mock them via vi.mock.

import './_setup/env';
import './_setup/auth-mock';
import './_setup/email-mock';

import { vi } from 'vitest';
import {
  bookingRow,
  instructorRow,
  prismaMock,
  resetPrisma,
  TEST_LEARNER_ACCESS_TOKEN,
} from './_setup/prisma-mock';
import {
  checkoutSessionResponse,
  installStripeProxy,
  verifyCheckoutResponse,
} from './_setup/stripe-proxy-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as paymentLinkPOST } from '@/app/api/bookings/[id]/payment-link/route';
import { GET as paymentPollGET } from '@/app/api/bookings/[id]/payment-poll/route';
import { BookingPaymentLinkResponse, BookingPaymentPollResponse } from '@/lib/contracts/bookings';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

let stripe: ReturnType<typeof installStripeProxy>;

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
  stripe = installStripeProxy();
});

afterEach(() => {
  stripe.restore();
});

function mkReq(url: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

function learnerGet(url: string): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

describe('/api/bookings/[id]/payment-link', () => {
  it('mints a checkout session via the stripe-billing proxy + persists id', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({ id: 'booking_pay', paymentStatus: null }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow({ hourlyRateSek: 550 }));
    prismaMock.booking.update.mockResolvedValueOnce({ id: 'booking_pay' });

    stripe.setResponse(
      'POST /api/v2/app-payments/checkout-session',
      // Learner pays the school price with no separate DriveLinkUp fee.
      // 550 SEK * 0.094 = 51.7 → ceil → $52.
      () => checkoutSessionResponse({ sessionId: 'cs_test_abc', amountUsd: 52 }),
    );

    const res = await paymentLinkPOST(
      mkReq('http://localhost/api/bookings/booking_pay/payment-link'),
      { params: Promise.resolve({ id: 'booking_pay' }) },
    );

    expect(res.status).toBe(200);
    const json = (await res.json()) as unknown;
    const parsed = BookingPaymentLinkResponse.parse(json);
    expect(parsed.url).toMatch(/^https:\/\/stripe\.test\//);
    expect(parsed.paymentStatus).toBe('pending');

    // The proxy received the right shape — recurring=false, amountUsd=55
    // (the school price), booking id carried in
    // success URL, a cancel URL.
    const checkoutCall = stripe.calls.find((c) =>
      c.url.endsWith('/api/v2/app-payments/checkout-session'),
    );
    expect(checkoutCall).toBeDefined();
    const body = checkoutCall?.body as {
      amount?: number;
      success_url?: string;
      cancel_url?: string;
      metadata?: { bookingId?: string; priceSek?: number; serviceFeeSek?: number };
    };
    expect(body.amount).toBe(52);
    expect(body.success_url).toContain('booking_pay');
    expect(body.cancel_url).toContain('/bookings/booking_pay');
    expect(body.success_url).toContain('token=');
    expect(body.cancel_url).toContain('token=');
    expect(body.metadata?.bookingId).toBe('booking_pay');
    // Stripe metadata is a string→string map; the integer SEK figures are
    // coerced at the call site (see payment-link/route.ts).
    expect(body.metadata?.priceSek).toBe('550');
    expect(body.metadata?.serviceFeeSek).toBe('0');

    // The booking row got the new session id + status + fee snapshot.
    expect(prismaMock.booking.update).toHaveBeenCalledOnce();
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_pay' },
        data: expect.objectContaining({
          paymentStatus: 'pending',
          stripeCheckoutSessionId: 'cs_test_abc',
          priceAmountSek: 550,
          serviceFeeSek: 0,
          grossChargedSek: 550,
        }),
      }),
    );
  });

  it('returns url:null on a second mint when status already held_escrow (idempotent)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({ id: 'booking_already', paymentStatus: 'held_escrow' }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    // IMPORTANT: do NOT register a stub — the test asserts NO fetch happened.

    const res = await paymentLinkPOST(
      mkReq('http://localhost/api/bookings/booking_already/payment-link'),
      { params: Promise.resolve({ id: 'booking_already' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentLinkResponse.parse((await res.json()) as unknown);
    expect(parsed.url).toBeNull();
    expect(parsed.paymentStatus).toBe('held_escrow');

    // No outbound call to the stripe-billing proxy (no second session).
    const callsToCheckout = stripe.calls.filter((c) =>
      c.url.endsWith('/api/v2/app-payments/checkout-session'),
    );
    expect(callsToCheckout).toHaveLength(0);
  });

  it('returns url:null on a second mint when status already released', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({ id: 'booking_done', paymentStatus: 'released' }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    const res = await paymentLinkPOST(
      mkReq('http://localhost/api/bookings/booking_done/payment-link'),
      { params: Promise.resolve({ id: 'booking_done' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentLinkResponse.parse((await res.json()) as unknown);
    expect(parsed.url).toBeNull();
    expect(parsed.paymentStatus).toBe('released');
  });

  it('404 when the booking row is gone', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);
    const res = await paymentLinkPOST(mkReq('http://localhost/api/bookings/missing/payment-link'), {
      params: Promise.resolve({ id: 'missing' }),
    });
    expect(res.status).toBe(404);
    expect(prismaMock.booking.update).not.toHaveBeenCalled();
  });

  it('403 when payments are not enabled (proxy returns not_enabled)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(bookingRow({ id: 'booking_x' }));
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());

    // The stripe-billing client recognises the (404, "not_enabled") tuple
    // and throws StripeBillingNotEnabledError; the route catches it and
    // returns 403 { errors: { payments: 'not_enabled' } }.
    stripe.setRawResponse(
      'POST /api/v2/app-payments/checkout-session',
      new Response(JSON.stringify({ error: 'not_enabled' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const res = await paymentLinkPOST(
      mkReq('http://localhost/api/bookings/booking_x/payment-link'),
      { params: Promise.resolve({ id: 'booking_x' }) },
    );
    expect(res.status).toBe(403);
  });
});

describe('SEK → USD floor (sekToUsdChargeAmount)', () => {
  // The brief in the audit asked for the floor to be exercised — the
  // helper's contract is: "Math.max(1, ceil(rate * 0.094))". The literal
  // "hourlyRateSek:50 → amountUsd:1" hint in the audit is illustrative of
  // the floor property; the actual ceiling of (50 * 0.094) = 4.7 is $5.
  // Below we exercise both the floor (sub-$1 in → $1 out) and a stack of
  // realistic rates (450/550 are the seeded min/typical).

  it('hourlyRateSek:1 → amountUsd:1 (raw 0.094 ceils to $1, never below Stripe minimum)', () => {
    expect(sekToUsdChargeAmount(1)).toBe(1);
  });

  it('hourlyRateSek:10 → amountUsd:1 (raw 0.94 ceils to $1, still hits floor)', () => {
    expect(sekToUsdChargeAmount(10)).toBe(1);
  });

  it('hourlyRateSek:11 → amountUsd:2 (raw 1.034 ceils to $2 — first step above the floor)', () => {
    expect(sekToUsdChargeAmount(11)).toBe(2);
  });

  it('hourlyRateSek:450 → amountUsd:43 (450 * 0.094 = 42.3 → ceil)', () => {
    // Smallest seeded rate in src/lib/business/run-seed.ts — proves the
    // helper works for the smallest legitimate booking.
    expect(sekToUsdChargeAmount(450)).toBe(43);
  });

  it('hourlyRateSek:550 → amountUsd:52 (550 * 0.094 = 51.7 → ceil)', () => {
    expect(sekToUsdChargeAmount(550)).toBe(52);
  });

  it('throws on a non-positive SEK rate', () => {
    expect(() => sekToUsdChargeAmount(0)).toThrow();
    expect(() => sekToUsdChargeAmount(-1)).toThrow();
  });
});

describe('/api/bookings/[id]/payment-poll', () => {
  it('returns verified=false when Stripe proxy says not-paid', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_pp1',
        paymentStatus: 'pending',
        stripeCheckoutSessionId: 'cs_test_xyz',
      }),
    );
    stripe.setResponse('GET /api/company-payments/verify', () =>
      verifyCheckoutResponse({ verified: false }),
    );

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp1/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp1' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(false);
  });

  it('flips pending → held_escrow on first verify + emits receipt emails', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_pp2',
        paymentStatus: 'pending',
        stripeCheckoutSessionId: 'cs_test_ok',
        preferredAt: new Date('2026-08-30T10:00:00.000Z'),
      }),
    );
    // The conditional updateMany returns count=1 (we won the race).
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    stripe.setResponse('GET /api/company-payments/verify', () =>
      verifyCheckoutResponse({ verified: true }),
    );

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp2/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp2' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(true);
    expect(parsed.paymentStatus).toBe('held_escrow');

    expect(prismaMock.booking.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking_pp2',
          paymentStatus: {
            notIn: [
              'held_escrow',
              'released',
              'refunded',
              'cancelled_early',
              'cancelled_late',
              'cancelled_full_refund',
              'cancelled_partial',
            ],
          },
        },
        data: expect.objectContaining({
          paymentStatus: 'held_escrow',
          actionToken: expect.any(String) as unknown as string,
        }),
      }),
    );

    // Two receipt emails (student + instructor).
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const emails = sendEmailMock.mock.calls.map((c) => c[0]);
    expect(emails.map((e) => e.to).sort()).toEqual([
      'erik@drivelinkup.test',
      'learner@example.test',
    ]);
    const learnerEmail = emails.find((email) => email.to === 'learner@example.test');
    const instructorEmail = emails.find((email) => email.to === 'erik@drivelinkup.test');
    expect(learnerEmail?.subject).toMatch(/receipt|kvitto/i);
    expect(learnerEmail?.text).toContain('Lektion: B · söndag 30 augusti 2026 kl. 12:00');
    expect(learnerEmail?.text).toContain('Boknings-id: booking_pp2');
    expect(learnerEmail?.text).not.toContain('2026-08-30T10:00:00.000Z');
    expect(instructorEmail?.text).toContain('Lektion: B · söndag 30 augusti 2026 kl. 12:00');
    expect(instructorEmail?.text).toContain('Brutto lektionspris:');
    expect(instructorEmail?.text).toContain('Nettoutbetalning:');
    expect(instructorEmail?.text).not.toContain('2026-08-30T10:00:00.000Z');
  });

  it('keeps payment held when one receipt fails and retries only that recipient later', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_pp_failure',
        paymentStatus: 'pending',
        stripeCheckoutSessionId: 'cs_test_failure',
      }),
    );
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );
    let failLearner = true;
    sendEmailMock.mockImplementation(async (...args: unknown[]) => {
      const input = args[0] as { to: string };
      if (failLearner && input.to === 'learner@example.test') {
        throw new Error('provider unavailable');
      }
      return { id: 'provider-message' };
    });
    stripe.setResponse('GET /api/company-payments/verify', () =>
      verifyCheckoutResponse({ verified: true }),
    );

    const first = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp_failure/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp_failure' }) },
    );
    const firstParsed = BookingPaymentPollResponse.parse((await first.json()) as unknown);
    expect(firstParsed.paymentStatus).toBe('held_escrow');
    expect(firstParsed.receiptEmailStatus).toBe('failed');
    expect(prismaMock.receiptStore.get('booking_pp_failure:learner')).toEqual(
      expect.objectContaining({ emailDeliveryStatus: 'failed' }),
    );
    failLearner = false;

    const heldBooking = bookingRow({
      id: 'booking_pp_failure',
      paymentStatus: 'held_escrow',
      stripeCheckoutSessionId: 'cs_test_failure',
    });
    prismaMock.booking.findUnique
      .mockResolvedValueOnce(heldBooking)
      .mockResolvedValueOnce(heldBooking);
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const retry = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp_failure/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp_failure' }) },
    );
    const retryParsed = BookingPaymentPollResponse.parse((await retry.json()) as unknown);
    expect(retryParsed.receiptEmailStatus).toBe('sent');
    expect(prismaMock.booking.updateMany).toHaveBeenCalledOnce();
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
    expect((sendEmailMock.mock.calls[2]?.[0] as { to: string }).to).toBe('learner@example.test');
  });

  it('second poll is a no-op (idempotent) — no extra updateMany, no extra emails', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_pp3',
        paymentStatus: 'held_escrow',
        stripeCheckoutSessionId: 'cs_test_done',
        actionToken: 'token_already',
        heldAt: new Date(),
      }),
    );

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pp3/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pp3' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(true);
    expect(parsed.paymentStatus).toBe('held_escrow');

    // No outbound verify, no updateMany, no email — booking is terminal.
    expect(stripe.calls.filter((c) => c.url.includes('verify'))).toHaveLength(0);
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('no stripeCheckoutSessionId ⇒ returns verified=false without calling Stripe', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({ id: 'booking_pre', paymentStatus: 'unpaid', stripeCheckoutSessionId: null }),
    );
    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_pre/payment-poll'),
      { params: Promise.resolve({ id: 'booking_pre' }) },
    );
    expect(res.status).toBe(200);
    const parsed = BookingPaymentPollResponse.parse((await res.json()) as unknown);
    expect(parsed.verified).toBe(false);

    expect(stripe.calls.filter((c) => c.url.includes('verify'))).toHaveLength(0);
  });
});
