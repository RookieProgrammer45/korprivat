//
// The other integration files lock in isolated segments (checkout +
// payment-poll, escrow terminal transitions, race-guards). This file is
// the
// cross-surface coverage: full booking payment→escrow→payout chain, fee
// snapshot stamping at the mint seam, payout stamping at release, and
// every error the routes can throw in production. Each block exercises a
// different request envelope and mocks every external surface (Prisma,
// Stripe proxy, email proxy, auth session) with the test helpers under
// _setup/.
//
// biome: this file is OUTSIDE the overrides' src/** glob.
//
// Scope:
//   G. Booking full chain: unpaid → mint → held_escrow → complete → released
//      + fee snapshot columns stamped at the mint seam (priceAmountSek /
//      serviceFeeSek / grossChargedSek) + payoutAmountSek stamped at release
//   H. Booking double-mint on `pending` → fresh URL (intentional)
//   I. Booking Stripe verify false → verified=false, no row update
//   J. Booking terminal state short-circuit (paid/released/refunded)
//   K. Booking dispute → resolve refunded  (cancel-before-payout)
//   L. Booking dispute → resolve released (operator chooses "release")
//
// Money model under test: each new booking charges the school price at the
// learner-paid USD charge; on completion the
// instructor is released lesson price − 10% commission (snapshot at
// release). With hourlyRateSek:550 this is:
//   learnerTotalSek(550) -> { priceSek:550, serviceFeeSek:0, totalSek:550 }
//   learnerTotalUsd(550)  -> sekToUsdChargeAmount(550) = 52
//   payoutAmountSek:550   -> instructorPayoutSek(550) = { payoutSek:495 }

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
const createCheckoutSession = vi.fn();
const retrieveCheckoutSession = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>();
  return {
    ...actual,
    after: (task: (() => unknown) | Promise<unknown>) => {
      if (typeof task === 'function') {
        void Promise.resolve().then(() => task());
      } else {
        void task;
      }
    },
  };
});
const payoutBookingMock = vi.fn();
vi.mock('@/lib/payments/payouts', () => ({
  payoutBooking: (...args: unknown[]) => payoutBookingMock(...args),
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
import { POST as completePOST } from '@/app/api/bookings/[id]/complete/route';
import { POST as disputeResolvePOST } from '@/app/api/bookings/[id]/dispute/resolve/route';
import { POST as disputePOST } from '@/app/api/bookings/[id]/dispute/route';
import { POST as checkoutPOST } from '@/app/api/checkout/route';
import { GET as paymentPollGET } from '@/app/api/bookings/[id]/payment-poll/route';

import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

// ─── Helpers ─────────────────────────────────────────────────────────

const SESSION_USER = {
  id: 'user_alice',
  email: 'alice@example.test',
  name: 'Alice Andersson',
  role: 'user' as const,
};

function postJson(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
}

function learnerGet(url: string): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
  authMock.setUser(SESSION_USER);
  createCheckoutSession.mockReset();
  retrieveCheckoutSession.mockReset();
  payoutBookingMock.mockReset();
  payoutBookingMock.mockResolvedValue({
    kind: 'sent',
    transferId: 'tr_chain',
    amountSek: 495,
    recipientType: 'INSTRUCTOR',
  });
  process.env.STRIPE_SECRET_KEY = 'sk_test_integration';
  createCheckoutSession.mockResolvedValue({
    id: 'cs_chain',
    url: 'https://checkout.stripe.com/c/pay/cs_chain',
  });
  retrieveCheckoutSession.mockResolvedValue({
    id: 'cs_chain',
    payment_status: 'unpaid',
    status: 'open',
  });
});

afterEach(() => {
  createCheckoutSession.mockReset();
  retrieveCheckoutSession.mockReset();
});

// ─── G. Booking full chain ──────────────────────────────────────────

describe('booking: full chain unpaid → mint → held_escrow → complete → released', () => {
  it('carries through to released with both receipt emails then completion email', async () => {
    // 1. checkout mints the session + stamps fee snapshot columns
    // Checkout route + createBookingCheckoutSession each call findUnique.
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_chain',
        paymentStatus: null,
        studentEmail: 'learner@example.test',
      }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ hourlyRateSek: 550 }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking_chain' });
    // 550 SEK school price → totalSek 550 → ceil(550 × 0.094) = 52
    createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_chain',
      url: 'https://checkout.stripe.com/c/pay/cs_chain',
    });

    const linkRes = await checkoutPOST(
      new Request('http://localhost/api/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ bookingId: 'booking_chain', token: TEST_LEARNER_ACCESS_TOKEN }),
      }),
    );
    expect(linkRes.status).toBe(200);

    // Fee snapshot columns stamped at the mint seam — once for this row,
    // never re-baked from a later `hourlyRateSek` drift. 550 → no learner fee.
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_chain' },
        data: expect.objectContaining({
          paymentStatus: 'pending',
          stripeSessionId: 'cs_chain',
          stripeCheckoutSessionId: 'cs_chain',
          priceAmountSek: 550,
          serviceFeeSek: 0,
          grossChargedSek: 550,
        }),
      }),
    );

    // Reset sticky mocks before the poll / complete segments.
    prismaMock.booking.findUnique.mockReset();
    prismaMock.instructor.findUnique.mockReset();
    prismaMock.booking.update.mockReset();

    // 2. payment-poll verifies → flips to held_escrow + receipts
    // Sticky until complete segment re-queues — poll + fulfill may re-read.
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({
        id: 'booking_chain',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_chain',
        stripeCheckoutSessionId: 'cs_chain',
      }),
    );
    prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValue(
      instructorRow({ email: 'erik@drivelinkup.test', hourlyRateSek: 550 }),
    );
    retrieveCheckoutSession.mockResolvedValue({
      id: 'cs_chain',
      payment_status: 'paid',
      status: 'complete',
    });

    const pollRes = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_chain/payment-poll'),
      { params: Promise.resolve({ id: 'booking_chain' }) },
    );
    expect(pollRes.status).toBe(200);
    const pollJson = (await pollRes.json()) as { verified: boolean; paymentStatus: string };
    expect(pollJson.verified).toBe(true);
    expect(pollJson.paymentStatus).toBe('held_escrow');

    // Two receipt emails.
    const receiptEmails = sendEmailMock.mock.calls.length;
    expect(receiptEmails).toBe(2);

    // Pull the action token from the updateMany so we can use it on complete.
    const updateData = (prismaMock.booking.updateMany.mock.calls[0][0] as { data: unknown })
      .data as { actionToken?: string };
    const token = updateData.actionToken;
    expect(typeof token).toBe('string');

    // 3. complete → flips to released, notifies counterparty
    prismaMock.booking.findUnique.mockReset();
    prismaMock.instructor.findUnique.mockReset();
    prismaMock.booking.findUnique
      .mockResolvedValueOnce(
        bookingRow({
          id: 'booking_chain',
          paymentStatus: 'held_escrow',
          actionToken: token,
          heldAt: new Date(),
          disputeStatus: null,
        }),
      )
      .mockResolvedValueOnce(
        bookingRow({
          id: 'booking_chain',
          paymentStatus: 'released',
          actionToken: token,
          completedAt: new Date(),
          payoutReleasedAt: new Date(),
          payoutAmountSek: 495,
        }),
      );
    prismaMock.instructor.findUnique
      .mockResolvedValueOnce(
        instructorRow({ hourlyRateSek: 550, email: 'erik@drivelinkup.test' }),
      )
      .mockResolvedValueOnce(instructorRow({ email: 'erik@drivelinkup.test' }));

    const completeRes = await completePOST(
      postJson('http://localhost/api/bookings/booking_chain/complete', {
        token,
        completedByRole: 'learner',
        completedByLabel: 'Alice Andersson',
      }),
      { params: Promise.resolve({ id: 'booking_chain' }) },
    );
    expect(completeRes.status).toBe(200);
    const completeBody = (await completeRes.json()) as { paymentStatus: string };
    expect(completeBody.paymentStatus).toBe('released');

    // Release path stamps the instructor payout via payoutBooking (Connect transfer).
    expect(payoutBookingMock).toHaveBeenCalledWith(
      'booking_chain',
      expect.objectContaining({
        completedByLabel: 'Alice Andersson',
      }),
    );

    // Receipts + 1 completion email = 3 total. Counterparty depends on which
    // token matched (actionToken ⇒ provider actor ⇒ learner notified).
    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalledTimes(receiptEmails + 1);
    });
    expect(['erik@drivelinkup.test', 'learner@example.test']).toContain(
      sendEmailMock.mock.calls[receiptEmails][0].to,
    );
  });
});

// ─── H. Booking double-mint on `pending` ────────────────────────────

describe('booking/checkout: re-mints on `pending` (intentional per comment)', () => {
  it('second POST while still `pending` returns a fresh URL (overwrites session id)', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({ id: 'booking_pending', paymentStatus: 'pending' }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ hourlyRateSek: 550 }));
    prismaMock.booking.update.mockResolvedValue({ id: 'booking_pending' });
    createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_remint',
      url: 'https://checkout.stripe.com/c/pay/cs_remint',
    });

    const res = await checkoutPOST(
      new Request('http://localhost/api/checkout', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ bookingId: 'booking_pending', token: TEST_LEARNER_ACCESS_TOKEN }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string | null; paymentStatus: string };
    expect(body.url).not.toBeNull();
    expect(body.paymentStatus).toBe('pending');

    // A NEW session was stamped on the row, and the fee snapshot columns
    // were re-stamped with the same figures so a second mint never drifts.
    expect(prismaMock.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_pending' },
        data: expect.objectContaining({
          paymentStatus: 'pending',
          stripeSessionId: 'cs_remint',
          stripeCheckoutSessionId: 'cs_remint',
          priceAmountSek: 550,
          serviceFeeSek: 0,
          grossChargedSek: 550,
        }),
      }),
    );
  });
});

// ─── I. Booking Stripe verify returns verified=false ─────────────────

describe('booking/payment-poll: verified=false leaves the row untouched', () => {
  it('no fulfilment, no emails, returns {verified:false, paymentStatus:pending}', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_unverified',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_yet',
        stripeCheckoutSessionId: 'cs_yet',
      }),
    );
    retrieveCheckoutSession.mockResolvedValueOnce({
      id: 'cs_yet',
      payment_status: 'unpaid',
      status: 'open',
    });

    const res = await paymentPollGET(
      learnerGet('http://localhost/api/bookings/booking_unverified/payment-poll'),
      { params: Promise.resolve({ id: 'booking_unverified' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { verified: boolean; paymentStatus: string };
    expect(body.verified).toBe(false);
    expect(body.paymentStatus).toBe('pending');

    // No row update. No email.
    expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

// ─── J. Booking terminal-state short-circuit ─────────────────────────

describe('booking/payment-poll: short-circuits on terminal paymentStatus', () => {
  for (const terminal of ['held_escrow', 'released', 'refunded']) {
    it(`${terminal} → 200 verified=true with current status, no Stripe call, no update`, async () => {
      prismaMock.booking.findUnique.mockResolvedValueOnce(
        bookingRow({
          id: `booking_${terminal}`,
          paymentStatus: terminal,
          paidAt: terminal === 'refunded' ? new Date() : new Date(),
          stripeSessionId: 'cs_terminal',
          stripeCheckoutSessionId: 'cs_terminal',
          actionToken: 'token_terminal',
          heldAt: new Date(),
        }),
      );

      const res = await paymentPollGET(
        learnerGet(`http://localhost/api/bookings/booking_${terminal}/payment-poll`),
        { params: Promise.resolve({ id: `booking_${terminal}` }) },
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { verified: boolean; paymentStatus: string };
      expect(body.verified).toBe(true);
      expect(body.paymentStatus).toBe(terminal);

      // No Stripe retrieve, no row update, no email.
      expect(retrieveCheckoutSession).not.toHaveBeenCalled();
      expect(prismaMock.booking.updateMany).not.toHaveBeenCalled();
      expect(sendEmailMock).not.toHaveBeenCalled();
    });
  }
});

// ─── K. Booking dispute → resolve refunded (cancel-before-payout) ──

describe('booking: dispute → resolve refunded (cancel-before-payout)', () => {
  it('opens dispute, then resolves refunded: paymentStatus=refunded, payoutReleasedAt stays NULL, both emails', async () => {
    const token = 'token_dispute_refund';

    // ---- open dispute ----
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_refund',
        paymentStatus: 'held_escrow',
        actionToken: token,
        heldAt: new Date(),
        disputeStatus: null,
      }),
    );
    prismaMock.dispute.create.mockResolvedValueOnce({ id: 'dispute_refund' });
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const openRes = await disputePOST(
      postJson('http://localhost/api/bookings/booking_refund/dispute', {
        token,
        openedByRole: 'learner',
        openedByLabel: 'Alice Andersson',
        reason: 'Instructor was 45 minutes late and unprofessional',
      }),
      { params: Promise.resolve({ id: 'booking_refund' }) },
    );
    expect(openRes.status).toBe(201);

    // ---- resolve refunded ----
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_refund',
        paymentStatus: 'held_escrow',
        actionToken: token,
        heldAt: new Date(),
        disputeStatus: 'open',
      }),
    );
    // The transaction includes updateMany on both booking + dispute.
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 1 }, { count: 1 }]);
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const resolveRes = await disputeResolvePOST(
      postJson('http://localhost/api/bookings/booking_refund/dispute/resolve', {
        token,
        outcome: 'refunded',
        resolvedByLabel: 'Support Agent',
        resolutionNote: 'Confirmed learning experience was below expectations.',
      }),
      { params: Promise.resolve({ id: 'booking_refund' }) },
    );
    expect(resolveRes.status).toBe(200);

    // The booking update set paymentStatus=refunded and DID NOT set payoutReleasedAt.
    const txCalls = prismaMock.$transaction.mock.calls;
    expect(txCalls.length).toBeGreaterThan(0);
    const txOps = (txCalls[txCalls.length - 1][0] as Array<unknown>).slice() as Array<
      Promise<unknown>
    >;
    // Resolve the ops so we can inspect the call shapes passed in.
    await Promise.all(txOps);
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_refund', disputeStatus: 'open' },
        data: expect.objectContaining({
          disputeStatus: 'resolved_refunded',
          paymentStatus: 'refunded',
        }),
      }),
    );
    // Refund path: do NOT carry payoutReleasedAt.
    const bookingUpdateCall = prismaMock.booking.updateMany.mock.calls.find(
      (c) => (c[0] as { data: { paymentStatus?: string } }).data.paymentStatus === 'refunded',
    );
    expect(bookingUpdateCall).toBeDefined();
    const refundData = (bookingUpdateCall?.[0] as { data: object }).data;
    expect(refundData).not.toHaveProperty('payoutReleasedAt');

    // After open (1 counterparty email) + resolve (2 parties notified),
    // expect exactly 3 emails dispatched in this test.
    expect(sendEmailMock).toHaveBeenCalledTimes(3);
    const last = sendEmailMock.mock.calls[2][0];
    expect(['erik@drivelinkup.test', SESSION_USER.email]).toContain(last.to);
    expect(last.subject).toMatch(/återbetalning|tvist/i);
  });
});

// ─── L. Booking dispute → resolve released ──────────────────────────

describe('booking: dispute → resolve released (funds go to instructor)', () => {
  it('flips paymentStatus=released, stamps payoutReleasedAt, both parties notified of release', async () => {
    const token = 'token_resolve_release';

    // Open dispute (skip the actual open path — pretend the dispute is already open).
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_release',
        paymentStatus: 'held_escrow',
        actionToken: token,
        heldAt: new Date(),
        disputeStatus: 'open',
      }),
    );
    prismaMock.$transaction.mockResolvedValueOnce([{ count: 1 }, { count: 1 }]);
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const resolveRes = await disputeResolvePOST(
      postJson('http://localhost/api/bookings/booking_release/dispute/resolve', {
        token,
        outcome: 'released',
        resolvedByLabel: 'Support Agent',
        resolutionNote: 'Both parties agreed the lesson met expectations.',
      }),
      { params: Promise.resolve({ id: 'booking_release' }) },
    );
    expect(resolveRes.status).toBe(200);

    // Resolve email: lands on + flows through $transaction
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'booking_release', disputeStatus: 'open' },
        data: expect.objectContaining({
          disputeStatus: 'resolved_released',
          paymentStatus: 'released',
          payoutReleasedAt: expect.any(Date) as unknown as Date,
          payoutAmountSek: 495,
          releasedByRole: 'instructor',
          releasedByLabel: 'Support Agent',
        }),
      }),
    );
    // Dispute row also resolved_released.
    expect(prismaMock.dispute.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookingId: 'booking_release', status: 'open' },
        data: expect.objectContaining({
          status: 'resolved_released',
          resolvedByLabel: 'Support Agent',
        }),
      }),
    );

    // Both parties notified (student + instructor). The booking row's
    // studentEmail is the default bookingRow helper value — auth-mock
    // doesn't bind booking to session user (the route is anonymous),
    // so the learner email above stands.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const recipients = sendEmailMock.mock.calls.map((c) => (c[0] as { to: string }).to).sort();
    expect(recipients).toEqual(['erik@drivelinkup.test', 'learner@example.test']);
    const subjects = sendEmailMock.mock.calls.map((c) => (c[0] as { subject: string }).subject);
    expect(subjects.every((s) => /tvist.*frigjord|frigjord/i.test(s))).toBe(true);
  });
});

// ─── Origin resolver priority (checkout sanity) ──────────────────

describe('checkout: success/cancel URLs use public app URL', () => {
  it('Checkout Session uses NEXT_PUBLIC_APP_URL / Origin for redirects', async () => {
    prismaMock.booking.findUnique.mockResolvedValue(
      bookingRow({ id: 'booking_origin', paymentStatus: null }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(
      instructorRow({ id: 'instructor_erik', hourlyRateSek: 550 }),
    );
    prismaMock.booking.update.mockResolvedValue({ id: 'booking_origin' });
    createCheckoutSession.mockResolvedValueOnce({
      id: 'cs_origin',
      url: 'https://checkout.stripe.com/c/pay/cs_origin',
    });

    const req = new Request('http://service-container:3000/api/checkout', {
      method: 'POST',
      headers: {
        origin: 'https://www.drivelinkup.com',
        Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ bookingId: 'booking_origin', token: TEST_LEARNER_ACCESS_TOKEN }),
    });
    const res = await checkoutPOST(req);
    expect(res.status).toBe(200);

    const arg = createCheckoutSession.mock.calls[0]?.[0] as {
      success_url?: string;
      cancel_url?: string;
    };
    expect(arg.success_url).toMatch(/^https:\/\/www\.drivelinkup\.com\//);
    expect(arg.cancel_url).toMatch(/^https:\/\/www\.drivelinkup\.com\//);
  });
});
