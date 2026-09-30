// Unit coverage for escrow admin/cron guards:
// - partial dispute resolve → 501
// - admin payout retry state gate
// - cron auto-release auth

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSession,
  mockBookingFindUnique,
  mockBookingUpdate,
  mockBookingFindMany,
  mockBookingUpdateMany,
  mockPayoutBooking,
  mockRefundBooking,
  mockSendEmail,
} = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockBookingFindUnique: vi.fn(),
  mockBookingUpdate: vi.fn(),
  mockBookingFindMany: vi.fn(),
  mockBookingUpdateMany: vi.fn(),
  mockPayoutBooking: vi.fn(),
  mockRefundBooking: vi.fn(),
  mockSendEmail: vi.fn(),
}));

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

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      findUnique: (...args: unknown[]) => mockBookingFindUnique(...args),
      update: (...args: unknown[]) => mockBookingUpdate(...args),
      findMany: (...args: unknown[]) => mockBookingFindMany(...args),
      updateMany: (...args: unknown[]) => mockBookingUpdateMany(...args),
    },
    instructor: {
      findUnique: vi.fn(async () => null),
    },
  },
}));

vi.mock('@/lib/payments/payouts', () => ({
  payoutBooking: (...args: unknown[]) => mockPayoutBooking(...args),
}));

vi.mock('@/lib/payments/refunds', () => ({
  refundBooking: (...args: unknown[]) => mockRefundBooking(...args),
}));

vi.mock('@/lib/email/send', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));

import { POST as resolveDisputePOST } from '@/app/api/admin/bookings/[id]/resolve-dispute/route';
import { POST as payoutRetryPOST } from '@/app/api/admin/payouts/retry/route';
import { POST as autoReleasePOST } from '@/app/api/cron/auto-release/route';

function jsonPost(url: string, body: unknown, headers?: Record<string, string>): Request {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockGetSession.mockReset();
  mockBookingFindUnique.mockReset();
  mockBookingUpdate.mockReset();
  mockBookingFindMany.mockReset();
  mockBookingUpdateMany.mockReset();
  mockPayoutBooking.mockReset();
  mockRefundBooking.mockReset();
  mockSendEmail.mockReset();
  mockGetSession.mockResolvedValue({ user: { role: 'admin', id: 'admin_1' } });
  mockPayoutBooking.mockResolvedValue({
    kind: 'sent',
    transferId: 'tr_test',
    amountSek: 450,
    recipientType: 'INSTRUCTOR',
  });
  delete process.env.CRON_SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('POST /api/admin/bookings/[id]/resolve-dispute', () => {
  it('outcome=partial → 501, no refund, no state change', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'booking_disputed',
      paymentStatus: 'disputed',
      grossChargedSek: 500,
    });

    const res = await resolveDisputePOST(
      jsonPost('/api/admin/bookings/booking_disputed/resolve-dispute', {
        outcome: 'partial',
        amountSek: 100,
        note: 'split the difference',
      }),
      { params: Promise.resolve({ id: 'booking_disputed' }) },
    );

    expect(res.status).toBe(501);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not_implemented');
    expect(mockRefundBooking).not.toHaveBeenCalled();
    expect(mockBookingUpdate).not.toHaveBeenCalled();
    expect(mockPayoutBooking).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/payouts/retry', () => {
  it('held_escrow → 409', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'b1',
      paymentStatus: 'held_escrow',
    });
    const res = await payoutRetryPOST(
      jsonPost('/api/admin/payouts/retry', { bookingId: 'b1' }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: string;
      currentState: string;
      message: string;
    };
    expect(body.error).toBe('invalid_state');
    expect(body.currentState).toBe('held_escrow');
    expect(body.message).toMatch(/delivery flow/i);
    expect(mockPayoutBooking).not.toHaveBeenCalled();
  });

  it('awaiting_buyer_confirmation → 409', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'b2',
      paymentStatus: 'awaiting_buyer_confirmation',
    });
    const res = await payoutRetryPOST(
      jsonPost('/api/admin/payouts/retry', { bookingId: 'b2' }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { currentState: string; message: string };
    expect(body.currentState).toBe('awaiting_buyer_confirmation');
    expect(body.message).toMatch(/does not bypass/i);
    expect(mockPayoutBooking).not.toHaveBeenCalled();
  });

  it('disputed → 409', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'b3',
      paymentStatus: 'disputed',
    });
    const res = await payoutRetryPOST(
      jsonPost('/api/admin/payouts/retry', { bookingId: 'b3' }),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { currentState: string };
    expect(body.currentState).toBe('disputed');
    expect(mockPayoutBooking).not.toHaveBeenCalled();
  });

  it('payout_failed → 200 and calls payoutBooking', async () => {
    mockBookingFindUnique.mockResolvedValue({
      id: 'b4',
      paymentStatus: 'payout_failed',
    });
    const res = await payoutRetryPOST(
      jsonPost('/api/admin/payouts/retry', { bookingId: 'b4' }),
    );
    expect(res.status).toBe(200);
    expect(mockPayoutBooking).toHaveBeenCalledWith(
      'b4',
      expect.objectContaining({ completedByLabel: 'admin_retry' }),
    );
  });
});

describe('POST /api/cron/auto-release', () => {
  it('no CRON_SECRET set → 401', async () => {
    delete process.env.CRON_SECRET;
    const res = await autoReleasePOST(
      jsonPost('/api/cron/auto-release', {}, { authorization: 'Bearer anything' }),
    );
    expect(res.status).toBe(401);
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });

  it('wrong Bearer → 401', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    const res = await autoReleasePOST(
      jsonPost('/api/cron/auto-release', {}, { authorization: 'Bearer wrong' }),
    );
    expect(res.status).toBe(401);
    expect(mockBookingFindMany).not.toHaveBeenCalled();
  });

  it('correct Bearer + zero candidates → 200 { scanned: 0 }', async () => {
    process.env.CRON_SECRET = 'expected-secret';
    mockBookingFindMany.mockResolvedValue([]);
    const res = await autoReleasePOST(
      jsonPost('/api/cron/auto-release', {}, { authorization: 'Bearer expected-secret' }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; scanned: number; released: number };
    expect(body).toEqual({ ok: true, scanned: 0, released: 0, failed: 0 });
    expect(mockPayoutBooking).not.toHaveBeenCalled();
  });
});
