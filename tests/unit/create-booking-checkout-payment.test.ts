import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBookingFindUnique, mockInstructorFindUnique, mockPayment } = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockPayment: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique },
    instructor: { findUnique: mockInstructorFindUnique },
  },
}));
vi.mock('@/lib/scheduling/listing-eligibility', () => ({
  loadInstructorPaymentEligibility: mockPayment,
}));
vi.mock('@/lib/payments/stripe', () => ({ getStripe: vi.fn() }));
vi.mock('@/lib/payments/origin', () => ({ resolveOrigin: () => 'https://www.drivelinkup.com' }));

import {
  createBookingCheckoutSession,
  IndependentInstructorPaymentError,
} from '@/lib/payments/create-booking-checkout';

describe('createBookingCheckoutSession payment gate', () => {
  beforeEach(() => {
    mockBookingFindUnique.mockReset();
    mockInstructorFindUnique.mockReset();
    mockPayment.mockReset();
    process.env.STRIPE_SECRET_KEY = 'sk_test_unit';
  });

  it('refuses to mint checkout when the instructor is not part of a school', async () => {
    mockBookingFindUnique.mockResolvedValueOnce({
      id: 'booking_1',
      instructorId: 'instructor_solo',
      priceAmountSek: 550,
      serviceFeeSek: 0,
      grossChargedSek: 550,
    });
    mockInstructorFindUnique.mockResolvedValueOnce({
      id: 'instructor_solo',
      name: 'Solo Instructor',
      hourlyRateSek: 550,
      userId: 'user_solo',
      providerRole: 'INSTRUCTOR',
    });
    mockPayment.mockResolvedValueOnce({
      allowed: false,
      code: 'independent_payment_refused',
    });

    await expect(
      createBookingCheckoutSession({
        bookingId: 'booking_1',
        req: new Request('http://localhost/api/checkout'),
      }),
    ).rejects.toMatchObject({
      name: 'IndependentInstructorPaymentError',
      code: 'independent_payment_refused',
    });
    expect(IndependentInstructorPaymentError).toBeDefined();
  });
});
