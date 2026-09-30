//
// Escrow delivery-confirmation flow:
//   held_escrow → POST /deliver (instructor) → awaiting_buyer_confirmation
//   → POST /confirm (buyer) → release_ready → payoutBooking
//   OR POST /dispute-escrow → disputed
//
// Legacy POST /complete delegates to /deliver (instructor-only).

import './_setup/env';
import './_setup/email-mock';
import { vi } from 'vitest';
import {
  bookingRow,
  instructorRow,
  prismaMock,
  resetPrisma,
  TEST_LEARNER_ACCESS_TOKEN,
} from './_setup/prisma-mock';

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
import { POST as confirmPOST } from '@/app/api/bookings/[id]/confirm/route';
import { POST as deliverPOST } from '@/app/api/bookings/[id]/deliver/route';
import { POST as disputeEscrowPOST } from '@/app/api/bookings/[id]/dispute-escrow/route';
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
    deliveredAt: Date | null;
    autoReleaseAt: Date | null;
    confirmedAt: Date | null;
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
  prismaMock.booking.updateMany.mockResolvedValue({ count: 1 });
});

afterEach(() => {});

describe('POST /api/bookings/[id]/deliver', () => {
  it('403 when the action token does not match', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    const res = await deliverPOST(
      jsonPost('/api/bookings/booking_escrow/deliver', {
        token: 'wrong_token',
        deliveredByLabel: 'Erik',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });

  it('403 when buyer (learner token) tries to mark delivered', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({ actionToken: 'provider_only' }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    const res = await deliverPOST(
      jsonPost('/api/bookings/booking_escrow/deliver', {
        token: TEST_LEARNER_ACCESS_TOKEN,
        deliveredByLabel: 'Learner',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });

  it('happy path: held_escrow → awaiting_buyer_confirmation, no payout', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ email: 'erik@test' }));

    const res = await deliverPOST(
      jsonPost('/api/bookings/booking_escrow/deliver', {
        token: VALID_TOKEN,
        deliveredByLabel: 'Erik Lindqvist',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paymentStatus: string; autoReleaseAt: string };
    expect(body.paymentStatus).toBe('awaiting_buyer_confirmation');
    expect(body.autoReleaseAt).toBeTruthy();
    expect(payoutBookingMock).not.toHaveBeenCalled();
    expect(prismaMock.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'awaiting_buyer_confirmation',
        }),
      }),
    );
    await vi.waitFor(() => {
      expect(sendEmailMock).toHaveBeenCalled();
    });
  });

  it('legacy /complete delegates to deliver for instructor', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow());
    const res = await completePOST(
      jsonPost('/api/bookings/booking_escrow/complete', {
        token: VALID_TOKEN,
        completedByLabel: 'Erik',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paymentStatus: string };
    expect(body.paymentStatus).toBe('awaiting_buyer_confirmation');
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/[id]/confirm', () => {
  it('403 when instructor tries to confirm', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        paymentStatus: 'awaiting_buyer_confirmation',
        deliveredAt: new Date(),
        autoReleaseAt: new Date(Date.now() + 86_400_000),
      }),
    );
    prismaMock.instructor.findUnique.mockResolvedValueOnce(instructorRow());
    const res = await confirmPOST(
      jsonPost('/api/bookings/booking_escrow/confirm', {
        token: VALID_TOKEN,
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });

  it('happy path: awaiting → release_ready and schedules payout', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        actionToken: 'provider_other',
        paymentStatus: 'awaiting_buyer_confirmation',
        deliveredAt: new Date(),
        autoReleaseAt: new Date(Date.now() + 86_400_000),
      }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ email: 'erik@test' }));

    const res = await confirmPOST(
      jsonPost('/api/bookings/booking_escrow/confirm', {
        token: TEST_LEARNER_ACCESS_TOKEN,
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paymentStatus: string };
    expect(body.paymentStatus).toBe('release_ready');
    await vi.waitFor(() => {
      expect(payoutBookingMock).toHaveBeenCalledWith(
        'booking_escrow',
        expect.objectContaining({ completedByRole: 'learner' }),
      );
    });
  });
});

describe('POST /api/bookings/[id]/dispute-escrow', () => {
  it('buyer opens dispute → disputed, no payout', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(
      heldBooking({
        actionToken: 'provider_other',
        paymentStatus: 'awaiting_buyer_confirmation',
        deliveredAt: new Date(),
        autoReleaseAt: new Date(Date.now() + 86_400_000),
      }),
    );
    prismaMock.instructor.findUnique.mockResolvedValue(instructorRow({ email: 'erik@test' }));

    const res = await disputeEscrowPOST(
      jsonPost('/api/bookings/booking_escrow/dispute-escrow', {
        token: TEST_LEARNER_ACCESS_TOKEN,
        reason: 'Lesson did not happen',
        details: 'No-show',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { paymentStatus: string };
    expect(body.paymentStatus).toBe('disputed');
    expect(payoutBookingMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/bookings/[id]/dispute (legacy open)', () => {
  it('403 on bad token', async () => {
    prismaMock.booking.findUnique.mockResolvedValueOnce(heldBooking());
    const res = await disputePOST(
      jsonPost('/api/bookings/booking_escrow/dispute', {
        token: 'bad',
        openedByRole: 'learner',
        openedByLabel: 'X',
        reason: 'problem',
      }),
      { params: Promise.resolve({ id: 'booking_escrow' }) },
    );
    expect(res.status).toBe(403);
  });
});
