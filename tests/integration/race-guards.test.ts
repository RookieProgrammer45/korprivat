//
// Race guards for payment-poll (paidAt updateMany) and welcome email.

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

const retrieveCheckoutSession = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
}));
vi.mock('stripe', () => {
  class StripeMock {
    checkout = {
      sessions: {
        create: vi.fn(),
        retrieve: (...args: unknown[]) => retrieveCheckoutSession(...args),
      },
    };
    webhooks = { constructEvent: vi.fn() };
    constructor(_key: string, _opts?: unknown) {}
  }
  return { default: StripeMock };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as signupRedirectPOST } from '@/app/api/auth/signup-redirect/route';
import { POST as welcomePOST } from '@/app/api/auth/welcome/route';
import { GET as paymentPollGET } from '@/app/api/bookings/[id]/payment-poll/route';
import { authMock } from './_setup/auth-mock';

const SESSION_USER = {
  id: 'user_race',
  email: 'race@example.test',
  name: 'Race Tester',
  role: 'user' as const,
};
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

function learnerGet(url: string): Request {
  return new Request(url, {
    headers: { Authorization: `Bearer ${TEST_LEARNER_ACCESS_TOKEN}` },
  });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  authMock.reset();
  retrieveCheckoutSession.mockReset();
  retrieveCheckoutSession.mockResolvedValue({
    id: 'cs_test',
    payment_status: 'paid',
    status: 'complete',
  });
  process.env.STRIPE_SECRET_KEY = 'sk_test_integration';
});

afterEach(() => {
  retrieveCheckoutSession.mockReset();
});

describe('payment-poll race guard', () => {
  it('two concurrent polls → held_escrow flips ONCE + exactly one winning updateMany', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_test_race',
        stripeCheckoutSessionId: 'cs_test_race',
      }),
    );
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'pending',
        stripeSessionId: 'cs_test_race',
        stripeCheckoutSessionId: 'cs_test_race',
      }),
    );
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      bookingRow({
        id: 'booking_race',
        paymentStatus: 'held_escrow',
        paidAt: new Date(),
        stripeSessionId: 'cs_test_race',
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
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
  });

  it('three concurrent polls — still ONE held-receipt send', async () => {
    for (let i = 0; i < 3; i++) {
      prismaMock.booking.findUnique.mockResolvedValueOnce(
        bookingRow({
          id: 'booking_3x',
          paymentStatus: 'pending',
          stripeSessionId: 'cs_test_3x',
          stripeCheckoutSessionId: 'cs_test_3x',
        }),
      );
    }
    for (let i = 0; i < 2; i++) {
      prismaMock.booking.findUnique.mockResolvedValueOnce(
        bookingRow({
          id: 'booking_3x',
          paymentStatus: 'held_escrow',
          paidAt: new Date(),
          stripeSessionId: 'cs_test_3x',
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
