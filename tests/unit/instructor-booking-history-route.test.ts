import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const bookingFindMany = vi.fn();
  const availabilitySlotFindMany = vi.fn();
  const bookingReceiptFindMany = vi.fn();
  const requireAuth = vi.fn();
  const resolveOwnedProvider = vi.fn();
  return {
    bookingFindMany,
    availabilitySlotFindMany,
    bookingReceiptFindMany,
    requireAuth,
    resolveOwnedProvider,
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: { findMany: hoisted.bookingFindMany },
    availabilitySlot: { findMany: hoisted.availabilitySlotFindMany },
    bookingReceipt: { findMany: hoisted.bookingReceiptFindMany },
  },
}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: hoisted.requireAuth }));
vi.mock('@/lib/business/provider-ownership', () => {
  class ProviderOwnershipError extends Error {
    readonly reason: 'missing' | 'ambiguous' | 'wrong-role';

    constructor(reason: 'missing' | 'ambiguous' | 'wrong-role') {
      super(reason);
      this.name = 'ProviderOwnershipError';
      this.reason = reason;
    }
  }
  return {
    ProviderOwnershipError,
    providerOwnershipErrorResponse: (error: InstanceType<typeof ProviderOwnershipError>) =>
      error.reason === 'wrong-role'
        ? { status: 403, message: 'This provider profile is not available for this account.' }
        : { status: 409, message: 'Provider ownership needs operator review.' },
    resolveOwnedProvider: hoisted.resolveOwnedProvider,
  };
});

import { GET } from '@/app/api/bookings/instructor/route';

const instructor = {
  id: 'instructor_1',
  name: 'Instructor',
  city: 'Stockholm',
  email: 'instructor@example.test',
  userId: 'user_instructor',
  providerRole: 'INSTRUCTOR' as const,
  categories: ['B'],
  hourlyRateSek: 900,
  bio: '',
  photoUrl: '',
  serviceArea: null,
  englishSpeaking: true,
  cancellationPolicyTier: 'flexible',
  bookingMode: 'instant',
};

const completedAt = new Date('2026-08-30T12:00:00.000Z');

function request(state = 'completed') {
  return new Request(`http://localhost/api/bookings/instructor?state=${state}`);
}

function booking(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking_1',
    studentName: 'Learner',
    category: 'B',
    preferredAt: new Date('2026-08-29T10:00:00.000Z'),
    paymentStatus: 'released',
    priceAmountSek: 550,
    serviceFeeSek: 28,
    grossChargedSek: 578,
    payoutAmountSek: 495,
    slotId: null,
    cancellationOutcome: null,
    cancelledAt: null,
    completedAt,
    disputeStatus: null,
    locale: 'sv',
    ...overrides,
  };
}

beforeEach(() => {
  hoisted.bookingFindMany.mockReset();
  hoisted.availabilitySlotFindMany.mockReset();
  hoisted.bookingReceiptFindMany.mockReset();
  hoisted.requireAuth.mockReset();
  hoisted.resolveOwnedProvider.mockReset();
  hoisted.requireAuth.mockResolvedValue({
    id: 'user_instructor',
    email: 'instructor@example.test',
  });
  hoisted.resolveOwnedProvider.mockResolvedValue(instructor);
  hoisted.bookingFindMany.mockResolvedValue([]);
  hoisted.availabilitySlotFindMany.mockResolvedValue([]);
  hoisted.bookingReceiptFindMany.mockResolvedValue([]);
});

describe('instructor completed booking history route', () => {
  it('rejects unauthenticated callers before resolving ownership', async () => {
    hoisted.requireAuth.mockRejectedValue(new Response(null, { status: 401 }));

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(hoisted.resolveOwnedProvider).not.toHaveBeenCalled();
    expect(hoisted.bookingFindMany).not.toHaveBeenCalled();
  });

  it('rejects a handledare or other wrong-role owner for completed history', async () => {
    const { ProviderOwnershipError } = await import('@/lib/business/provider-ownership');
    hoisted.resolveOwnedProvider.mockRejectedValue(new ProviderOwnershipError('wrong-role'));

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(hoisted.bookingFindMany).not.toHaveBeenCalled();
  });

  it('filters to completed, released, non-cancelled bookings and joins canonical snapshots', async () => {
    hoisted.bookingFindMany.mockResolvedValue([booking()]);
    hoisted.bookingReceiptFindMany.mockResolvedValue([
      {
        bookingId: 'booking_1',
        priceAmountSek: 550,
        serviceFeeSek: 28,
        grossChargedSek: 578,
        commissionSek: 55,
        payoutStatus: 'released',
        netPayoutSek: 495,
        emailDeliveryStatus: 'sent',
      },
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(hoisted.resolveOwnedProvider).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_instructor' }),
      ['INSTRUCTOR'],
    );
    expect(hoisted.bookingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          instructorId: 'instructor_1',
          completedAt: { not: null },
          paymentStatus: 'released',
          cancelledAt: null,
          cancellationOutcome: null,
        },
      }),
    );
    expect(body.items).toEqual([
      expect.objectContaining({
        id: 'booking_1',
        grossChargedSek: 578,
        serviceFeeSek: 28,
        commissionSek: 55,
        netPayoutSek: 495,
        receiptAvailable: true,
        receiptStatus: 'released',
      }),
    ]);
  });

  it('returns an honest empty result without loading receipts when there are no matches', async () => {
    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ items: [] });
    expect(hoisted.bookingReceiptFindMany).not.toHaveBeenCalled();
  });

  it('preserves persisted booking amounts for a legacy row with no receipt snapshot', async () => {
    hoisted.bookingFindMany.mockResolvedValue([
      booking({
        serviceFeeSek: null,
        grossChargedSek: null,
        payoutAmountSek: 495,
      }),
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toEqual(
      expect.objectContaining({
        priceAmountSek: 550,
        serviceFeeSek: null,
        grossChargedSek: null,
        commissionSek: 55,
        netPayoutSek: 495,
        receiptAvailable: false,
      }),
    );
  });
});
