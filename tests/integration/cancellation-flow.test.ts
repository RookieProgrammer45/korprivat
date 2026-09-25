// @polsia:user-owned — booking cancellation flow.
//
// `POST /api/bookings/[id]/cancel` has three windows:
//   - early (cancel > LATE_WINDOW_HOURS before start) → 'cancelled_early',
//                                                   no fee, slot freed.
//   - late  (cancel ≤ LATE_WINDOW_HOURS before start) → 'cancelled_late',
//                                                   LateCancellationFee row,
//                                                   slot freed.
//
// Plus the guard cases:
//   - 403 on bad token; 404 on missing booking; 409 on already-settled.
//   - 409 on cancel after lesson start (past window).
//   - 200 idempotent on a second cancel call against an already-cancelled row.

import './_setup/env';
import './_setup/email-mock';
import { vi } from 'vitest';
import { bookingRow, instructorRow, prismaMock, resetPrisma } from './_setup/prisma-mock';

vi.mock('server-only', () => ({}));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as cancelPOST } from '@/app/api/bookings/[id]/cancel/route';
import { resetEmailMock, sendEmailMock } from './_setup/email-mock';

// Bookings with their preferredAt set far in the future / close to the
// now() called inside the route at the moment of testing. The route
// reads `now = new Date()` at the top — the resolver's wall clock is
// the fixture source of truth.
const FAR_FUTURE = new Date('2099-01-01T08:00:00.000Z');
const SOON = new Date(Date.now() + 60 * 60 * 1000); // 1h from now → late window
const PAST = new Date('2026-01-01T08:00:00.000Z');

const VALID_TOKEN = 'token_abc123';

function jsonPost(url: string, body: unknown): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function heldBooking(overrides: Partial<Parameters<typeof bookingRow>[0]> = {}) {
  return bookingRow({
    id: 'booking_cancel',
    actionToken: VALID_TOKEN,
    paymentStatus: 'held_escrow',
    heldAt: new Date(Date.now() - 60 * 60 * 1000),
    preferredAt: FAR_FUTURE,
    ...overrides,
  });
}

beforeEach(() => {
  resetPrisma();
  resetEmailMock();
});

afterEach(() => {
  // nothing to restore
});

describe('POST /api/bookings/[id]/cancel — guards', () => {
  it('404 when the booking cannot be found', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(null);
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(404);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('403 when the action token does not match', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: 'wrong_token',
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(403);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it('409 when the booking is already released (post-payout)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ paymentStatus: 'released' }));
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('409 when the booking is already refunded', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ paymentStatus: 'refunded' }));
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('409 when the lesson has already started (past window)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ preferredAt: PAST }));
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(409);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('400 on missing cancelledByLabel', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(400);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('200 idempotent on second cancel of an already-early-cancelled booking', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        cancellationOutcome: 'cancelled_early',
        cancelledAt: new Date(),
        cancelledByLabel: 'Previous Canceller',
      }),
    );
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cancellationOutcome: string; feeAmountUsd: number | null };
    expect(body.cancellationOutcome).toBe('cancelled_early');
    expect(body.feeAmountUsd).toBeNull();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/[id]/cancel — early window', () => {
  it('records NO fee, frees the slot, and emails both parties (neutral copy)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking()); // preferredAt = FAR_FUTURE → early
    // booking.updateMany returns count=1 — we won the race guard.
    // The early path still loads the instructor once so receipt repair and
    // notification use the same name, email, and rate snapshot.
    prismaMock.instructor.findUnique.mockResolvedValueOnce(
      instructorRow({ email: 'erik@drivelinkup.test' }),
    );
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByRole: 'learner',
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      paymentStatus: string;
      cancellationOutcome: string;
      feeAmountUsd: number | null;
    };
    expect(body.paymentStatus).toBe('cancelled_full_refund');
    expect(body.cancellationOutcome).toBe('cancelled_full_refund');
    expect(body.feeAmountUsd).toBeNull();

    // Late path: NO lateCancellationFee.create() at all.
    expect(prismaMock.lateCancellationFee.create).not.toHaveBeenCalled();

    // Slot freed — `availableSlot.updateMany` was called with the right
    // where-filter (bookedBookingId === booking.id, bookedAt = null).
    expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookedBookingId: 'booking_cancel' },
        data: { bookedAt: null, bookedBookingId: null },
      }),
    );

    // Notify BOTH parties.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const learners = sendEmailMock.mock.calls.map((call) => stringArg(call[0], 'to'));
    expect(learners).toContain('learner@example.test');
    expect(learners).toContain('erik@drivelinkup.test');

    expect(prismaMock.bookingReceipt.upsert).toHaveBeenCalledTimes(2);
    type ReceiptUpsertCall = [
      {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      },
    ];
    const receiptCreates = (
      prismaMock.bookingReceipt.upsert.mock.calls as unknown as ReceiptUpsertCall[]
    ).map((call) => call[0].create);
    expect(receiptCreates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          recipientRole: 'learner',
          paymentStatus: 'cancelled_full_refund',
          payoutStatus: 'not_applicable',
        }),
        expect.objectContaining({
          recipientRole: 'instructor',
          paymentStatus: 'cancelled_full_refund',
          payoutStatus: 'cancelled',
        }),
      ]),
    );
  });

  it('instructor email falls back when the instructor has no email recorded', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow({ email: null }));
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    expect(stringArg(sendEmailMock.mock.calls[0][0], 'to')).toBe('learner@example.test');
  });

  it('cancel from the unpaid (pre-payment) state flips to cancelled_early without a fee', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ paymentStatus: 'unpaid' }));
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());

    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    expect(prismaMock.lateCancellationFee.create).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/[id]/cancel — late window', () => {
  it('records a fee + frees the slot + emails both parties (fee to learner, neutral to instructor)', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking({ preferredAt: SOON }));
    // For the late branch the route calls prisma.instructor.findUnique for
    // the rate. Two calls in total (rate lookup, then notifyAfterCancel's
    // lookup). Use mockResolvedValue — the rate lookup and the email
    // notify both want the same instructor row.
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());
    // The transaction claims the booking before creating the fee.
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({ count: 1 });

    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByRole: 'learner',
        cancelledByLabel: 'Test Learner',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      paymentStatus: string;
      cancellationOutcome: string;
      feeAmountUsd: number | null;
    };
    expect(body.paymentStatus).toBe('cancelled_late');
    expect(body.cancellationOutcome).toBe('cancelled_late');
    expect(body.feeAmountUsd).not.toBeNull();

    // Fee row is inserted only after the booking claim.
    expect(prismaMock.lateCancellationFee.create).toHaveBeenCalledOnce();
    expect(prismaMock.booking.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.lateCancellationFee.create.mock.invocationCallOrder[0],
    );
    const feeCreateArgs = prismaMock.lateCancellationFee.create.mock.calls[0][0] as {
      data: {
        bookingId: string;
        amountUsd: number;
        feePercentApplied: number;
        windowHoursAtCancel: number;
        status: string;
      };
    };
    expect(feeCreateArgs.data.bookingId).toBe('booking_cancel');
    expect(feeCreateArgs.data.feePercentApplied).toBeGreaterThan(0);
    expect(feeCreateArgs.data.windowHoursAtCancel).toBeGreaterThanOrEqual(0);
    expect(feeCreateArgs.data.status).toBe('recorded');

    // Booking row flipped: cancellationOutcome='cancelled_late', paymentStatus='cancelled_late'.
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'booking_cancel',
          cancellationOutcome: null,
          paymentStatus: {
            in: ['unpaid', 'pending', 'paid', 'held_escrow', 'awaiting_approval'],
          },
        }),
        data: expect.objectContaining({
          paymentStatus: 'cancelled_late',
          cancellationOutcome: 'cancelled_late',
          cancelledByRole: 'learner',
          cancelledByLabel: 'Test Learner',
        }),
      }),
    );

    // Slot freed.
    expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bookedBookingId: 'booking_cancel' },
      }),
    );

    // 2 emails sent — learner gets the fee receipt, instructor gets the
    // neutral notification.
    expect(sendEmailMock).toHaveBeenCalledTimes(2);
    const learnerMail = sendEmailMock.mock.calls.find(
      (call) => stringArg(call[0], 'to') === 'learner@example.test',
    );
    const instructorMail = sendEmailMock.mock.calls.find(
      (call) => stringArg(call[0], 'to') === 'erik@drivelinkup.test',
    );
    expect(learnerMail).toBeDefined();
    expect(instructorMail).toBeDefined();
    expect(learnerMail?.[0]?.subject).toMatch(/avgift/i);
  });
});

describe('POST /api/bookings/[id]/cancel — race guards', () => {
  it('second concurrent cancel sees prior outcome and returns 200 (idempotent)', async () => {
    // First-arriving call was read by the route pre-transaction. By the
    // time the second call's `findUnique` runs, the row is already cancelled.
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        cancellationOutcome: 'cancelled_late',
        paymentStatus: 'cancelled_late',
        cancelledAt: new Date(),
        cancelledByLabel: 'Prior Canceller',
      }),
    );
    const txCallsBefore = prismaMock.$transaction.mock.calls.length;
    const emailCallsBefore = sendEmailMock.mock.calls.length;
    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Second Arrival',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cancellationOutcome: string };
    expect(body.cancellationOutcome).toBe('cancelled_late');
    expect(prismaMock.$transaction.mock.calls.length).toBe(txCallsBefore);
    expect(sendEmailMock.mock.calls.length).toBe(emailCallsBefore);
  });

  it('does not create a fee when the booking race guard loses', async () => {
    prismaMock.booking.findUnique
      .mockResolvedValueOnce(heldBooking({ preferredAt: SOON }))
      .mockResolvedValueOnce(
        heldBooking({
          paymentStatus: 'cancelled_late',
          cancellationOutcome: 'cancelled_late',
          cancelledAt: new Date(),
        }),
      );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());
    prismaMock.booking.updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await cancelPOST(
      jsonPost('/api/bookings/booking_cancel/cancel', {
        token: VALID_TOKEN,
        cancelledByLabel: 'Losing Canceller',
      }),
      { params: Promise.resolve({ id: 'booking_cancel' }) },
    );

    expect(res.status).toBe(200);
    expect(prismaMock.lateCancellationFee.create).not.toHaveBeenCalled();
    expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

function stringArg(input: unknown, key: string): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  return typeof (input as Record<string, unknown>)[key] === 'string'
    ? (input as Record<string, string>)[key]
    : undefined;
}
