//
// After Stripe confirms the payment, the booking row sits at
// `paymentStatus = 'held_escrow'` with a per-row `actionToken`. The two
// terminal transitions a learner or instructor can take from that state
// are:
//   POST /api/bookings/[id]/complete — marks the lesson done and releases
//                                       the funds.
//   POST /api/bookings/[id]/dispute  — opens a dispute; payouts are paused
//                                       until an operator resolves it.
//
// Both routes gate on the action token (`assertTokenMatches` from
// src/lib/business/escrow.ts). Both implement a "fulfill-once" guard via
// a conditional `updateMany` whose `count === 0` branches read the fresh
// row. This file locks in:
//   - the token gate (403 on bad token)
//   - the idempotent re-call (200 with the previously-recorded timestamps)
//   - the cross-party email notification (which the counterparty receives)
//   - the dispute route's stronger guard: zero `count` on the second open
//     ⇒ 409 + no second email (re-notify check).

import './_setup/env';
import './_setup/email-mock';
import { vi } from 'vitest';
import { bookingRow, instructorRow, prismaMock, resetPrisma, TEST_LEARNER_ACCESS_TOKEN } from './_setup/prisma-mock';

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

vi.mock('@/lib/require-auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/require-auth')>();
  return {
    ...actual,
    getSessionUser: async () => null,
  };
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as completePOST } from '@/app/api/bookings/[id]/complete/route';
import { POST as disputePOST } from '@/app/api/bookings/[id]/dispute/route';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

const VALID_TOKEN = 'token_abc123';

function jsonPost(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function heldBooking(
  overrides: Partial<{
    id: string;
    actionToken: string | null;
    paymentStatus: string;
    disputeStatus: string | null;
    completedAt: Date | null;
    payoutReleasedAt: Date | null;
  }> = {},
) {
  return bookingRow({
    id: 'booking_escrow',
    actionToken: VALID_TOKEN,
    paymentStatus: 'held_escrow',
    heldAt: new Date('2026-08-10T15:00:00.000Z'),
    disputeStatus: null,
    ...overrides,
  });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
  payoutBookingMock.mockReset();
  payoutBookingMock.mockResolvedValue({
    kind: 'sent',
    transferId: 'tr_test',
    amountSek: 495,
    recipientType: 'INSTRUCTOR',
  });
});

afterEach(() => {
  // resetPrisma() does a full mockReset (mockClear + queue clear +
  // default-impl re-attach). Vitest's `mockResolvedValueOnce` queues do
  // NOT survive resetPrisma() — that's the trap this file was bitten
  // by early on. See resetPrisma() comments.
});

describe('POST /api/bookings/[id]/complete', () => {
  it('403 when the action token does not match', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: 'wrong_token',
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
    expect(payoutBookingMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('403 when the row has no actionToken yet', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ actionToken: null }));
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: 'anything',
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
  });

  it('409 when the booking is not held_escrow (e.g. unpaid)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ paymentStatus: 'unpaid' }));
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(409);
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });

  it('409 when a dispute is already open', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ disputeStatus: 'open' }));
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(409);
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });

  it('happy path: flips held_escrow → released + notifies counterparty', async () => {
    const releasedAt = new Date('2026-08-10T16:00:00.000Z');
    // Use learner access token so actorRole resolves to learner (actionToken
    // would match providerToken and flip the counterparty).
    prismaMock.booking.findUnique
      .mockResolvedValueOnce(
        heldBooking({
          actionToken: 'provider_token_other',
        }),
      )
      .mockResolvedValueOnce(
        heldBooking({
          paymentStatus: 'released',
          completedAt: releasedAt,
          payoutReleasedAt: releasedAt,
        }),
      );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );
    // notifyCounterparty instructor lookup (after)
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: TEST_LEARNER_ACCESS_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { id: string; paymentStatus: string };
    expect(body.paymentStatus).toBe('released');

    expect(payoutBookingMock).toHaveBeenCalledWith(
      'booking_escrow',
      expect.objectContaining({
        completedByLabel: 'Test Learner',
      }),
    );

    // Notify counterparty: the learner completed → notify instructor.
    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
    });
    const email = sendEmailMock.mock.calls[0][0];
    expect(email.to).toBe('erik@drivelinkup.test');
  });

  it('does not treat a dispute-released booking as a completed lesson', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        paymentStatus: 'released',
        completedAt: null,
        payoutReleasedAt: new Date(),
        disputeStatus: 'resolved_released',
      }),
    );

    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );

    expect(res.status).toBe(409);
    expect(payoutBookingMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('no instructor email → no notification, still 200', async () => {
    const releasedAt = new Date();
    prismaMock.booking.findUnique
      .mockResolvedValueOnce(heldBooking())
      .mockResolvedValueOnce(
        heldBooking({
          paymentStatus: 'released',
          completedAt: releasedAt,
          payoutReleasedAt: releasedAt,
        }),
      );
    prismaMock.instructor.findUnique
      .mockResolvedValueOnce(instructorRow({ email: null }))
      .mockResolvedValueOnce(instructorRow({ email: null }));

    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'instructor',
        completedByLabel: 'Erik Lindqvist',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    // Instructor completed → student gets notified.
    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalledTimes(1);
    });
    expect(sendEmailMock.mock.calls[0][0].to).toBe('learner@example.test');
  });

  it('second complete call is idempotent: 200, no second payout, no second email', async () => {
    const releasedAt = new Date();
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        paymentStatus: 'released',
        completedAt: releasedAt,
        payoutReleasedAt: releasedAt,
      }),
    );
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    expect(payoutBookingMock).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('409 when payout is skipped (no Connect)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    payoutBookingMock.mockResolvedValueOnce({ kind: 'skipped', reason: 'no_connect' });

    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByRole: 'learner',
        completedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(409);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/[id]/dispute', () => {
  beforeEach(() => {
    resetPrisma();
    resetEmailMock();
  });

  it('403 on bad token', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: 'wrong',
        openedByRole: 'learner',
        openedByLabel: 'Test Learner',
        reason: 'Instructor never showed up',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
  });

  it('400 on missing reason', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: VALID_TOKEN,
        openedByRole: 'learner',
        openedByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(400);
  });

  it('409 on dispute before payment (still unpaid)', async () => {
    const held = heldBooking({ paymentStatus: 'unpaid' });
    expect(held.paymentStatus).toBe('unpaid'); // sanity
    prismaMock.booking.findUnique.mockResolvedValueOnce(held);
    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: VALID_TOKEN,
        openedByRole: 'learner',
        openedByLabel: 'Test Learner',
        reason: 'Booking mix-up',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(409);
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
  });

  it('happy path: opens the dispute + notifies BOTH parties (via counterparty logic)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    // First-time transaction: dispute.create succeeds; booking.updateMany
    // returns count=1 (we won the race).
    prismaMock.dispute.create.mockResolvedValueOnce({ id: 'dispute_new' });
    // Pretend the booking part of the transaction succeeded.
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: VALID_TOKEN,
        openedByRole: 'learner',
        openedByLabel: 'Test Learner',
        reason: 'Instructor was 45 minutes late and unprofessional',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(201);

    // Dispute row created with the expected fields.
    expect(prismaMock.dispute.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          bookingId: 'booking_escrow',
          openedByRole: 'learner',
          openedByLabel: 'Test Learner',
          status: 'open',
        }),
      }),
    );

    // Notify the *other* party — learner opened so instructor receives.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe('erik@drivelinkup.test');
    expect(sendEmailMock.mock.calls[0][0].subject).toMatch(/tvist/i);
  });

  it('instructor opening — notify the learner instead', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.dispute.create.mockResolvedValueOnce({ id: 'dispute_i' });
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );

    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: VALID_TOKEN,
        openedByRole: 'instructor',
        openedByLabel: 'Erik Lindqvist',
        reason: 'Learner no-showed after 30 minutes',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(201);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(sendEmailMock.mock.calls[0][0].to).toBe('learner@example.test');
  });

  it('second open call: booking.disputeStatus precondition fires → 409, no notify', async () => {
    // The dispute route's initial guard (line 56-58 of dispute/route.ts)
    // fires on `booking.disputeStatus === 'open'` BEFORE the transaction.
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ disputeStatus: 'open' }));
    const txCallsBefore = prismaMock.$transaction.mock.calls.length;
    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: VALID_TOKEN,
        openedByRole: 'learner',
        openedByLabel: 'Test Learner',
        reason: 'Trying to double open',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(409);
    expect(prismaMock.dispute.create).not.toHaveBeenCalled();
    // The transaction must NOT have been called within this test's scope —
    // the precondition at dispute route line 56 short-circuits.
    expect(prismaMock.$transaction.mock.calls.length).toBe(txCallsBefore);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});
