// @polsia:user-owned — receipt delivery claim, failure, and duplicate coverage.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  bookingFindUnique: vi.fn(),
  receiptFindUnique: vi.fn(),
  receiptUpdateMany: vi.fn(),
  bookingUpdate: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: hoisted.bookingFindUnique, update: hoisted.bookingUpdate },
    bookingReceipt: {
      findUnique: hoisted.receiptFindUnique,
      updateMany: hoisted.receiptUpdateMany,
    },
  },
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: hoisted.sendEmail }));

import { deliverBookingReceipt } from '@/lib/business/receipt-delivery';

const booking = {
  id: 'booking_delivery',
  studentName: 'Learner',
  studentEmail: 'learner@example.test',
  instructorId: 'instructor_1',
  actionToken: 'action-token',
  learnerAccessTokenHash: 'old-hash',
  instructor: { email: 'instructor@example.test', name: 'Instructor' },
};

const receipt = {
  id: 'receipt_learner',
  receiptNumber: 'DLU-BOOKING_DELIVERY-L',
  bookingId: 'booking_delivery',
  recipientRole: 'learner',
  locale: 'en',
  learnerName: 'Learner',
  instructorName: 'Instructor',
  category: 'B',
  scheduledAt: new Date('2026-09-01T10:00:00.000Z'),
  priceAmountSek: 550,
  serviceFeeSek: 28,
  grossChargedSek: 578,
  commissionSek: 55,
  netPayoutSek: 495,
  emailDeliveryStatus: 'pending',
};

const request = new Request('https://drivelinkup.example/bookings/booking_delivery/receipt');

beforeEach(() => {
  hoisted.bookingFindUnique.mockReset();
  hoisted.receiptFindUnique.mockReset();
  hoisted.receiptUpdateMany.mockReset();
  hoisted.bookingUpdate.mockReset();
  hoisted.sendEmail.mockReset();
  hoisted.bookingFindUnique.mockResolvedValue(booking);
  hoisted.receiptFindUnique.mockResolvedValue(receipt);
  hoisted.receiptUpdateMany.mockResolvedValue({ count: 1 });
  hoisted.bookingUpdate.mockResolvedValue(booking);
  hoisted.sendEmail.mockResolvedValue({ id: 'provider-message-1' });
});

describe('deliverBookingReceipt', () => {
  it('marks a successful provider send as sent', async () => {
    const result = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req: request,
      learnerAccessToken: 'new-learner-token',
    });

    expect(result).toEqual({ status: 'sent', attempted: true });
    expect(hoisted.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: booking.studentEmail }),
    );
    expect(hoisted.receiptUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ emailDeliveryStatus: 'sent' }),
      }),
    );
  });

  it('persists failed when the provider returns an empty id', async () => {
    hoisted.sendEmail.mockResolvedValue({ id: ' ' });

    const result = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req: request,
      learnerAccessToken: 'new-learner-token',
    });

    expect(result.status).toBe('failed');
    expect(hoisted.receiptUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailDeliveryStatus: 'failed',
          emailFailureReason: 'Email provider returned no message id',
        }),
      }),
    );
  });

  it('persists failed when the provider throws', async () => {
    hoisted.sendEmail.mockRejectedValue(new Error('provider unavailable'));

    const result = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req: request,
      learnerAccessToken: 'new-learner-token',
    });

    expect(result).toEqual({
      status: 'failed',
      attempted: true,
      failureReason: 'provider unavailable',
    });
    expect(hoisted.receiptUpdateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailDeliveryStatus: 'failed',
          emailFailureReason: 'provider unavailable',
        }),
      }),
    );
  });

  it('retries a failed row and never resends a sent row', async () => {
    hoisted.receiptFindUnique
      .mockResolvedValueOnce({ ...receipt, emailDeliveryStatus: 'failed' })
      .mockResolvedValueOnce({ ...receipt, emailDeliveryStatus: 'sent' });

    const retry = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req: request,
      learnerAccessToken: 'new-learner-token',
    });

    expect(retry).toEqual({ status: 'sent', attempted: true });
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);

    hoisted.sendEmail.mockClear();
    hoisted.receiptUpdateMany.mockResolvedValueOnce({ count: 0 });
    const duplicate = await deliverBookingReceipt({
      bookingId: booking.id,
      recipientRole: 'learner',
      req: request,
      learnerAccessToken: 'new-learner-token',
    });

    expect(duplicate).toEqual({ status: 'sent', attempted: false });
    expect(hoisted.sendEmail).not.toHaveBeenCalled();
  });

  it('allows only the successful claim to send concurrently', async () => {
    let claims = 0;
    hoisted.receiptUpdateMany.mockImplementation(
      async (args: { data?: { emailDeliveryStatus?: string } }) => {
        if (args.data?.emailDeliveryStatus === 'sending') {
          claims += 1;
          return { count: claims === 1 ? 1 : 0 };
        }
        return { count: 1 };
      },
    );

    const results = await Promise.all([
      deliverBookingReceipt({
        bookingId: booking.id,
        recipientRole: 'learner',
        req: request,
        learnerAccessToken: 'token-1',
      }),
      deliverBookingReceipt({
        bookingId: booking.id,
        recipientRole: 'learner',
        req: request,
        learnerAccessToken: 'token-2',
      }),
    ]);

    expect(results.filter((result) => result.attempted)).toHaveLength(1);
    expect(hoisted.sendEmail).toHaveBeenCalledTimes(1);
  });
});
