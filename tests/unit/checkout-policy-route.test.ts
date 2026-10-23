import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockBookingFindUnique, mockInstructorFindUnique, mockCreateCheckout } = vi.hoisted(() => ({
  mockBookingFindUnique: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockCreateCheckout: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findUnique: mockBookingFindUnique },
    instructor: { findUnique: mockInstructorFindUnique },
  },
}));
vi.mock('@/lib/require-auth', () => ({
  getSessionUser: vi.fn(async () => null),
  requireAuth: vi.fn(async () => {
    throw new Error('auth should not run before the policy gate');
  }),
}));
vi.mock('@/lib/payments/create-booking-checkout', () => ({
  createBookingCheckoutSession: mockCreateCheckout,
  CheckoutConfigurationError: class CheckoutConfigurationError extends Error {},
}));
vi.mock('@/lib/payments/fulfill-checkout', () => ({
  markBookingPaidFromCheckout: vi.fn(),
}));
vi.mock('@/lib/payments/stripe', () => ({ getStripe: vi.fn() }));

import { POST } from '@/app/api/checkout/route';

beforeEach(() => {
  mockBookingFindUnique.mockReset();
  mockInstructorFindUnique.mockReset();
  mockCreateCheckout.mockReset();
  delete process.env.CANCELLATION_POLICY_ENFORCE;
});

afterEach(() => {
  delete process.env.CANCELLATION_POLICY_ENFORCE;
});

describe('POST /api/checkout cancellation policy', () => {
  it('SC-18 refuses checkout when enforcement is on and no policy is approved', async () => {
    process.env.CANCELLATION_POLICY_ENFORCE = '1';
    mockBookingFindUnique.mockResolvedValueOnce({
      id: 'booking_1',
      instructorId: 'inst_1',
    });
    mockInstructorFindUnique.mockResolvedValueOnce({ id: 'inst_1', userId: 'user_1' });

    const res = await POST(
      new Request('http://localhost/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ bookingId: 'booking_1' }),
      }),
    );

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: 'cancellation_policy_unapproved' } });
    expect(mockCreateCheckout).not.toHaveBeenCalled();
  });
});
