// @polsia:user-owned — race-guards for the trust-critical flow.
//
// Two scenarios where concurrent calls would otherwise double-trigger a
// side effect:
//
//   1. Two parallel GET /api/bookings/[id]/payment-poll after Stripe
//      confirms — the row flips `pending` → `held_escrow` EXACTLY ONCE.
//      The route's `updateMany({ where: { paymentStatus: { notIn: [...] } } })`
//      is the fulfill-once gate: only ONE poll wins (count === 1); the
//      other reads back the now-held row, sees it's already terminal, and
//      skips the held-receipt email send.
//
//   2. Two parallel POST /api/auth/welcome after signup — the
//      `updateMany({ where: { welcomeSentAt: null } })` lets only the
//      first call through (count === 1); the second sees count === 0 and
//      returns 204 without sending.
//
//   3. Two parallel POST /api/auth/signup-redirect — the UserProfile
//      row already exists (the User.create.after hook in
//      src/lib/auth-config.ts upserts it); the `updateMany` shape
//      doesn't apply here — the route calls `update` which serialises
//      naturally because update uses userId (primary key), so concurrent
//      calls land at the same row without a unique-violation. We're
//      not testing the database engine; we're testing that the route
//      DOESN'T call `create` a second time (no duplicate profiles).
//
// biome: this file is OUTSIDE the overrides' src/** glob.

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
import { installStripeProxy, verifyCheckoutResponse } from './_setup/stripe-proxy-mock';

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as signupRedirectPOST } from '@/app/api/auth/signup-redirect/route';
import { POST as welcomePOST } from '@/app/api/auth/welcome/route';

import { GET as paymentPollGET } from '@/app/api/bookings/[id]/payment-poll/route';
import { authMock } from './_setup/auth-mock';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

const SESSION_USER = {
  id: 'user_alice',
  email: 'alice@example.test',
  name: 'Alice',
  role: 'user' as const,
};

let stripe: ReturnType<typeof installStripeProxy>;

function learnerGet(url: string): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
  stripe = installStripeProxy();
});

afterEach(() => {
  stripe.restore();
});

describe('payment-poll race guard', () => {
  // The route's flow per call is:
  //   1. findUnique (initial read) → status snapshot
  //   2. verifyCheckoutSession (Stripe proxy) → verified
  //   3. updateMany (conditional pending→held_escrow)
  //   4. if count===0: findUnique (re-read) → return fresh.status
  //      if count===1: sendHeldReceipts
  // The race guard is the updateMany's `where` clause in 3 — only the
  // first poll sees a match.
  //
  // To simulate this with mocked prisma, we control two mock-fn outputs:
  //   - findUnique: returns 'pending' on initial reads, but the route's
  //     stale-row re-read on the LOSER branch returns 'held_escrow' (the
  //     row that updateMany just flipped).
  //   - updateMany: returns count=1 for the first call, count=0 thereafter.

  it('two concurrent polls → held_escrow flips ONCE + exactly one updateMany', async () => {
    // Both polls read pending on the initial snapshot.
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'pending',
        stripeCheckoutSessionId: 'cs_test_race',
      }),
    );
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'pending',
        stripeCheckoutSessionId: 'cs_test_race',
      }),
    );
    // Re-read for the LOSER branch.
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'held_escrow',
        stripeCheckoutSessionId: 'cs_test_race',
        heldAt: new Date(),
      }),
    );
    let n = 0;
    prismaMock.booking.updateMany.mockImplementation(async () => {
      n += 1;
      return { count: n === 1 ? 1 : 0 };
    });
    prismaMock.instructor.findUnique.mockResolvedValue(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    stripe.setResponse('GET /api/company-payments/verify', () =>
      verifyCheckoutResponse({ verified: true }),
    );

    const url = 'http://localhost/api/bookings/booking_race/payment-poll';
    const [r1, r2] = await Promise.all([
      paymentPollGET(learnerGet(url), { params: Promise.resolve({ id: 'booking_race' }) }),
      paymentPollGET(learnerGet(url), { params: Promise.resolve({ id: 'booking_race' }) }),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const [b1, b2] = (await Promise.all([r1.json(), r2.json()])) as Array<{
      verified: boolean;
      paymentStatus: string;
    }>;
    expect(b1.verified).toBe(true);
    expect(b2.verified).toBe(true);
    expect(b1.paymentStatus).toBe('held_escrow');
    expect(b2.paymentStatus).toBe('held_escrow');

    expect(prismaMock.booking.updateMany).toHaveBeenCalledTimes(2);

    // Receipts fire only once — the WINNER (count===1) sends 2 emails
    // (student + instructor). The LOSER short-circuits at line ~78 of
    // payment-poll/route.ts (the "if (updateResult.count === 0)" branch).
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it('three concurrent polls — still ONE held-receipt send (count===1 only on first)', async () => {
    // Three initial reads + two loser re-reads (the first request
    // succeeded; the other two need a fresh snapshot).
    for (let i = 0; i < 3; i++) {
      prismaMock.booking.findUnique.mockResolvedValueOnce(
        bookingRow({
          id: 'booking_3x',
          paymentStatus: 'pending',
          stripeCheckoutSessionId: 'cs_test_3x',
        }),
      );
    }
    for (let i = 0; i < 2; i++) {
      prismaMock.booking.findUnique.mockResolvedValueOnce(
        bookingRow({
          id: 'booking_3x',
          paymentStatus: 'held_escrow',
          stripeCheckoutSessionId: 'cs_test_3x',
        }),
      );
    }
    let n = 0;
    prismaMock.booking.updateMany.mockImplementation(async () => {
      n += 1;
      return { count: n === 1 ? 1 : 0 };
    });
    prismaMock.instructor.findUnique.mockResolvedValue(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );
    stripe.setResponse('GET /api/company-payments/verify', () =>
      verifyCheckoutResponse({ verified: true }),
    );

    const url = 'http://localhost/api/bookings/booking_3x/payment-poll';
    const responses = await Promise.all([
      paymentPollGET(learnerGet(url), { params: Promise.resolve({ id: 'booking_3x' }) }),
      paymentPollGET(learnerGet(url), { params: Promise.resolve({ id: 'booking_3x' }) }),
      paymentPollGET(learnerGet(url), { params: Promise.resolve({ id: 'booking_3x' }) }),
    ]);

    for (const r of responses) {
      expect(r.status).toBe(200);
    }
    expect(prismaMock.booking.updateMany).toHaveBeenCalledTimes(3);
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });
});

describe('welcome idempotency under concurrency', () => {
  it('two concurrent welcome POSTs — exactly one welcome email dispatched', async () => {
    authMock.setUser(SESSION_USER);
    // Only the FIRST updateMany wins; the second sees welcomeSentAt set.
    let n = 0;
    prismaMock.userProfile.updateMany.mockImplementation(async () => {
      n += 1;
      return { count: n === 1 ? 1 : 0 };
    });
    prismaMock.userProfile.findUnique.mockResolvedValueOnce({
      userId: SESSION_USER.id,
      role: 'STUDENT',
      welcomeSentAt: null,
    });

    const url = 'http://localhost/api/auth/welcome';
    const body = JSON.stringify({ email: SESSION_USER.email });
    const req1 = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });
    const req2 = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    });

    const [r1, r2] = await Promise.all([welcomePOST(req1), welcomePOST(req2)]);

    expect(r1.status).toBe(204);
    expect(r2.status).toBe(204);
    expect(prismaMock.userProfile.updateMany).toHaveBeenCalledTimes(2);
    // The sendEmail call only fires after count===1; the second call
    // sees count===0 and bypasses both findUnique+sendEmail.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe('signup-redirect: no duplicate profile on parallel post', () => {
  it('two concurrent role writes — no duplicate UserProfile insert', async () => {
    authMock.setUser(SESSION_USER);
    // Track create() to assert it is NEVER called by this route — the
    // profile row is created by the user.create.after hook, not by
    // signup-redirect itself.
    prismaMock.userProfile.create.mockClear();
    prismaMock.userProfile.update.mockResolvedValue({
      id: 'row',
      userId: SESSION_USER.id,
      role: 'INSTRUCTOR',
    });

    const url = 'http://localhost/api/auth/signup-redirect';
    const body1 = JSON.stringify({ role: 'STUDENT' });
    const body2 = JSON.stringify({ role: 'INSTRUCTOR' });
    const [r1, r2] = await Promise.all([
      signupRedirectPOST(
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body1,
        }),
      ),
      signupRedirectPOST(
        new Request(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: body2,
        }),
      ),
    ]);

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Profile creation is exclusively the hook's job — the route only UPDATES.
    expect(prismaMock.userProfile.create).not.toHaveBeenCalled();
    expect(prismaMock.userProfile.update).toHaveBeenCalledTimes(2);

    const calls = prismaMock.userProfile.update.mock.calls
      .map((c) => (c[0] as { data: { role: string } }).data.role)
      .sort();
    expect(calls).toEqual(['INSTRUCTOR', 'STUDENT']);
  });
});
