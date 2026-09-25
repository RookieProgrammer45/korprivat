// @polsia:user-owned — receipt calculations and wire-shape coverage.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  bookingReceipt: {
    findMany: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []),
    updateMany: vi.fn(async () => ({ count: 1 })),
    upsert: vi.fn(async () => ({})),
  },
  instructor: {
    findUnique: vi.fn(async () => null),
  },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));

import { receiptAmounts, repairPaidCancellationReceipts } from '@/lib/business/receipts';
import { Receipt } from '@/lib/contracts/receipts';
import { bookingReceiptEmail } from '@/lib/email/templates';

beforeEach(() => {
  prismaMock.bookingReceipt.findMany.mockReset();
  prismaMock.bookingReceipt.findMany.mockResolvedValue([]);
  prismaMock.bookingReceipt.updateMany.mockReset();
  prismaMock.bookingReceipt.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.bookingReceipt.upsert.mockReset();
  prismaMock.bookingReceipt.upsert.mockResolvedValue({});
  prismaMock.instructor.findUnique.mockReset();
  prismaMock.instructor.findUnique.mockResolvedValue(null);
});

describe('receipt calculations', () => {
  it('uses the booking fee model for learner and instructor amounts', () => {
    expect(
      receiptAmounts({ priceAmountSek: 550, serviceFeeSek: 28, grossChargedSek: 578 }, 550),
    ).toEqual({
      priceAmountSek: 550,
      serviceFeeSek: 28,
      grossChargedSek: 578,
      commissionSek: 55,
      netPayoutSek: 495,
    });
  });

  it('falls back to the live rate for legacy rows', () => {
    expect(
      receiptAmounts({ priceAmountSek: null, serviceFeeSek: null, grossChargedSek: null }, 450),
    ).toEqual({
      priceAmountSek: 450,
      serviceFeeSek: 0,
      grossChargedSek: 450,
      commissionSek: 45,
      netPayoutSek: 405,
    });
  });
});

describe('paid cancellation receipt repair', () => {
  const booking = {
    id: 'booking_cancel',
    userId: 'learner_1',
    studentName: 'Current Learner Name',
    instructorId: 'instructor_1',
    category: 'B',
    preferredAt: new Date('2026-09-10T10:00:00.000Z'),
    paymentStatus: 'cancelled_partial',
    priceAmountSek: 600,
    serviceFeeSek: 30,
    grossChargedSek: 630,
    payoutAmountSek: null,
    heldAt: new Date('2026-08-30T10:00:00.000Z'),
    payoutReleasedAt: null,
  };
  const instructor = {
    name: 'Current Instructor Name',
    city: 'Gothenburg',
    hourlyRateSek: 600,
    userId: 'instructor_user_1',
  };

  it('completes a partial repair from the established snapshot', async () => {
    prismaMock.bookingReceipt.findMany.mockResolvedValueOnce([
      {
        recipientRole: 'learner',
        recipientUserId: 'learner_1',
        locale: 'en',
        learnerName: 'Original Learner Name',
        instructorName: 'Original Instructor Name',
        instructorCity: 'Stockholm',
        category: 'A',
        scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
        durationMinutes: 90,
        priceAmountSek: 550,
        serviceFeeSek: 28,
        grossChargedSek: 578,
        commissionSek: 55,
        netPayoutSek: 495,
        verifiedAmountUsd: 61,
      },
    ]);

    await repairPaidCancellationReceipts({
      booking,
      instructor,
      paymentStatus: 'cancelled_partial',
      verifiedAmountUsd: 99,
    });

    expect(prismaMock.bookingReceipt.upsert).toHaveBeenCalledTimes(2);
    type ReceiptUpsertCall = [
      {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      },
    ];
    const receiptUpsertCalls = prismaMock.bookingReceipt.upsert.mock
      .calls as unknown as ReceiptUpsertCall[];
    const instructorUpsert = receiptUpsertCalls.find(
      (call) => call[0].create.recipientRole === 'instructor',
    );
    expect(instructorUpsert?.[0].create).toEqual(
      expect.objectContaining({
        locale: 'en',
        learnerName: 'Original Learner Name',
        instructorName: 'Original Instructor Name',
        instructorCity: 'Stockholm',
        category: 'A',
        scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
        durationMinutes: 90,
        priceAmountSek: 550,
        serviceFeeSek: 28,
        grossChargedSek: 578,
        commissionSek: 55,
        netPayoutSek: 495,
        verifiedAmountUsd: 61,
        paymentStatus: 'cancelled_partial',
        payoutStatus: 'cancelled',
      }),
    );
    expect(receiptUpsertCalls[0]?.[0].update).toEqual(
      expect.objectContaining({
        paymentStatus: 'cancelled_partial',
        payoutStatus: 'not_applicable',
      }),
    );
  });

  it('does not manufacture a receipt for an unpaid cancellation', async () => {
    await repairPaidCancellationReceipts({
      booking: { ...booking, paymentStatus: 'pending', heldAt: null },
      instructor,
      paymentStatus: 'cancelled_full_refund',
      verifiedAmountUsd: 1,
    });

    expect(prismaMock.bookingReceipt.upsert).not.toHaveBeenCalled();
    expect(prismaMock.bookingReceipt.updateMany).not.toHaveBeenCalled();
  });

  it('keeps learner payout not_applicable while cancelling instructor payout', async () => {
    prismaMock.bookingReceipt.findMany.mockResolvedValueOnce([
      { recipientRole: 'learner' },
      { recipientRole: 'instructor' },
    ]);

    await repairPaidCancellationReceipts({
      booking,
      instructor,
      paymentStatus: 'cancelled_late',
      verifiedAmountUsd: 1,
    });

    expect(prismaMock.bookingReceipt.updateMany).toHaveBeenNthCalledWith(1, {
      where: { bookingId: 'booking_cancel', recipientRole: 'learner' },
      data: { paymentStatus: 'cancelled_late', payoutStatus: 'not_applicable' },
    });
    expect(prismaMock.bookingReceipt.updateMany).toHaveBeenNthCalledWith(2, {
      where: { bookingId: 'booking_cancel', recipientRole: 'instructor' },
      data: { paymentStatus: 'cancelled_late', payoutStatus: 'cancelled' },
    });
  });
});

describe('receipt contract and copy', () => {
  it('keeps learner and instructor financial fields audience-specific', () => {
    const common = {
      receiptNumber: 'DLU-BOOKING-L',
      bookingId: 'booking_1',
      locale: 'en' as const,
      learnerName: 'Learner',
      instructorName: 'Instructor',
      instructorCity: 'Stockholm',
      category: 'B',
      scheduledAt: '2026-08-30T10:00:00.000Z',
      durationMinutes: 60,
      verifiedAmountUsd: 55,
      paymentStatus: 'held_escrow',
      emailDeliveryStatus: null,
      issuedAt: '2026-08-30T10:00:00.000Z',
    };
    expect(
      Receipt.parse({
        ...common,
        recipientRole: 'learner',
        lessonPriceSek: 550,
        serviceFeeSek: 28,
        totalPaidSek: 578,
        payoutStatus: 'not_applicable',
      }).recipientRole,
    ).toBe('learner');
    expect(
      Receipt.parse({
        ...common,
        receiptNumber: 'DLU-BOOKING-I',
        recipientRole: 'instructor',
        grossLessonPriceSek: 550,
        grossChargedSek: 578,
        serviceFeeSek: 28,
        commissionSek: 55,
        netPayoutSek: 495,
        payoutStatus: 'pending',
      }).recipientRole,
    ).toBe('instructor');
  });

  it('renders Swedish and English receipt email copy', () => {
    const input = {
      recipientRole: 'learner' as const,
      recipientName: 'Learner',
      instructorName: 'Instructor',
      category: 'B',
      lessonDate: '2026-08-30T10:00:00.000Z',
      receiptUrl: 'https://example.test/receipt',
      bookingId: 'booking_1',
      priceAmountSek: 550,
      serviceFeeSek: 28,
      grossChargedSek: 578,
      commissionSek: 55,
      netPayoutSek: 495,
    };
    const english = bookingReceiptEmail({ ...input, locale: 'en' });
    const swedish = bookingReceiptEmail({ ...input, locale: 'sv' });

    expect(english.subject).toContain('booking receipt');
    expect(english.text).toContain('Lesson: B · Sunday, 30 August 2026 at 12:00');
    expect(english.text).toContain('Lesson price: 550 SEK');
    expect(english.text).toContain('DriveLinkUp fee: 28 SEK');
    expect(english.text).toContain('Total paid: 578 SEK');
    expect(english.text).toContain('Booking ID: booking_1');
    expect(english.text).not.toContain('Boknings-id:');
    expect(english.text).not.toContain(input.lessonDate);

    expect(swedish.subject).toContain('bokningskvitto');
    expect(swedish.text).toContain('Lektion: B · söndag 30 augusti 2026 kl. 12:00');
    expect(swedish.text).toContain('Lektionspris: 550 SEK');
    expect(swedish.text).toContain('DriveLinkUp-avgift: 28 SEK');
    expect(swedish.text).toContain('Totalt betalt: 578 SEK');
    expect(swedish.text).toContain('Boknings-id: booking_1');
    expect(swedish.text).not.toContain('Booking ID:');
    expect(swedish.text).not.toContain(input.lessonDate);

    const instructor = bookingReceiptEmail({
      ...input,
      locale: 'en',
      recipientRole: 'instructor',
    });
    expect(instructor.text).toContain('Gross paid by learner: 578 SEK');
    expect(instructor.text).toContain('DriveLinkUp fee: 28 SEK');
    expect(instructor.text).toContain('School commission after completion: 55 SEK');
    expect(instructor.text).toContain('Net payout: 495 SEK');
  });
});
