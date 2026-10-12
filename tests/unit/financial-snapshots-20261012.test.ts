import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ upsert: vi.fn(async () => ({})) }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: { bookingReceipt: { upsert: mocks.upsert } } }));

import { lessonPriceForDurationSek } from '@/lib/business/booking-fees';
import {
  cancellationRefundAmountSek,
  computeCancellationFeeSek,
} from '@/lib/business/cancellation-policy';
import { ensureBookingReceipts, receiptResponse } from '@/lib/business/receipts';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';

const booking = {
  id: 'booking',
  userId: 'learner',
  studentName: 'Learner',
  instructorId: 'provider',
  category: 'B',
  preferredAt: new Date('2030-01-01T10:00:00Z'),
  paymentStatus: 'held_escrow',
  priceAmountSek: 550,
  serviceFeeSek: 0,
  grossChargedSek: 550,
  payoutAmountSek: 495,
};
const instructor = {
  name: 'Provider',
  city: 'Stockholm',
  hourlyRateSek: 999,
  userId: 'provider-user',
};

beforeEach(() => vi.clearAllMocks());

describe('immutable integer SEK snapshots', () => {
  it.each([40, 45, 60, 90])(
    'prices a %i-minute lesson from the rate and rounds exactly once',
    (duration) => {
      expect(lessonPriceForDurationSek(550, duration)).toBe(Math.round((550 * duration) / 60));
    },
  );
  it.each([0, -1, 1.5, Number.NaN])('rejects invalid duration %s', (duration) => {
    expect(() => lessonPriceForDurationSek(550, duration)).toThrow();
  });
  it.each([0, 1, 499, 500, 501, 999, 1000])(
    'conserves every SEK of an odd or even charge %i',
    (gross) => {
      for (const percentage of [0, 50, 100]) {
        const refund = cancellationRefundAmountSek(gross, percentage);
        const fee = computeCancellationFeeSek(gross, percentage);
        expect(refund + fee).toBe(gross);
        expect(Number.isInteger(refund)).toBe(true);
        expect(Number.isInteger(fee)).toBe(true);
        expect(fee).toBeGreaterThanOrEqual(0);
        expect(fee).toBeLessThanOrEqual(gross);
      }
    },
  );
  it('creates SEK-backed receipts without relabelling legacy USD storage or changing persisted financial snapshots', async () => {
    await ensureBookingReceipts({ booking, instructor, verifiedAmountSek: 550 });
    expect(mocks.upsert).toHaveBeenCalledTimes(2);
    for (const [arg] of mocks.upsert.mock.calls as unknown as Array<
      [{ create: Record<string, unknown>; update: Record<string, unknown> }]
    >) {
      expect(arg.create).toMatchObject({
        priceAmountSek: 550,
        grossChargedSek: 550,
        verifiedAmountUsd: sekToUsdChargeAmount(550),
      });
      expect(arg.update).not.toHaveProperty('verifiedAmountUsd');
      expect(arg.update).not.toHaveProperty('grossChargedSek');
    }
  });
  it.each([1, 549, 551, 550.4, Number.NaN])(
    'rejects receipt evidence %s that is not an exact integer SEK checkout total',
    async (amount) => {
      await expect(
        ensureBookingReceipts({ booking, instructor, verifiedAmountSek: amount }),
      ).rejects.toThrow('verified_checkout_amount_mismatch');
      expect(mocks.upsert).not.toHaveBeenCalled();
    },
  );
  it('maps historical receipts to their frozen SEK total, never relabelling the approximate USD column as SEK', () => {
    const result = receiptResponse({
      receiptNumber: 'DLU-BOOKING-L',
      bookingId: 'booking',
      recipientRole: 'learner',
      locale: 'en',
      learnerName: 'Learner',
      instructorName: 'Provider',
      instructorCity: 'Stockholm',
      category: 'B',
      scheduledAt: booking.preferredAt,
      durationMinutes: 60,
      priceAmountSek: 550,
      serviceFeeSek: 0,
      grossChargedSek: 550,
      commissionSek: 55,
      netPayoutSek: 495,
      verifiedAmountUsd: 61,
      paymentStatus: 'held_escrow',
      payoutStatus: 'not_applicable',
      issuedAt: booking.preferredAt,
    });
    expect(result.verifiedAmountSek).toBe(550);
    expect(result).not.toHaveProperty('verifiedAmountUsd');
  });
});
