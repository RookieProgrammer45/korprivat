import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const bookingCount = vi.fn();
  const bookingFindMany = vi.fn();
  const profileFindUnique = vi.fn();
  const requireAuth = vi.fn();
  const resolveOwnedProvider = vi.fn();
  class ProviderOwnershipError extends Error {
    readonly reason: 'missing' | 'ambiguous' | 'wrong-role';

    constructor(reason: 'missing' | 'ambiguous' | 'wrong-role') {
      super(reason);
      this.name = 'ProviderOwnershipError';
      this.reason = reason;
    }
  }

  return {
    bookingCount,
    bookingFindMany,
    profileFindUnique,
    requireAuth,
    resolveOwnedProvider,
    ProviderOwnershipError,
  };
});

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    booking: {
      count: hoisted.bookingCount,
      findMany: hoisted.bookingFindMany,
    },
    userProfile: { findUnique: hoisted.profileFindUnique },
  },
}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: hoisted.requireAuth }));
vi.mock('@/lib/business/provider-ownership', () => ({
  ProviderOwnershipError: hoisted.ProviderOwnershipError,
  providerOwnershipErrorResponse: (error: InstanceType<typeof hoisted.ProviderOwnershipError>) =>
    error.reason === 'wrong-role'
      ? { status: 403, message: 'This provider profile is not available for this account.' }
      : { status: 409, message: 'Provider ownership needs operator review.' },
  resolveOwnedProvider: hoisted.resolveOwnedProvider,
}));

import { GET } from '@/app/api/dashboard/completed-lessons/route';

const provider = {
  id: 'instructor_1',
  providerRole: 'INSTRUCTOR' as const,
};

function request() {
  return new Request('http://localhost/api/dashboard/completed-lessons');
}

function lesson(overrides: Record<string, unknown> = {}) {
  return {
    id: 'booking_1',
    studentName: 'Learner',
    category: 'B',
    preferredAt: new Date('2026-08-27T10:00:00.000Z'),
    completedAt: new Date('2026-08-28T12:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  hoisted.bookingCount.mockReset();
  hoisted.bookingFindMany.mockReset();
  hoisted.profileFindUnique.mockReset();
  hoisted.requireAuth.mockReset();
  hoisted.resolveOwnedProvider.mockReset();
  hoisted.requireAuth.mockResolvedValue({ id: 'user_provider', email: 'provider@example.test' });
  hoisted.profileFindUnique.mockResolvedValue({ role: 'INSTRUCTOR' });
  hoisted.resolveOwnedProvider.mockResolvedValue(provider);
  hoisted.bookingCount.mockResolvedValue(0);
  hoisted.bookingFindMany.mockResolvedValue([]);
});

describe('GET /api/dashboard/completed-lessons', () => {
  it('returns 401 before reading provider data without an authenticated session', async () => {
    hoisted.requireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));

    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(hoisted.profileFindUnique).not.toHaveBeenCalled();
    expect(hoisted.bookingCount).not.toHaveBeenCalled();
  });

  it('returns 403 for a non-provider profile', async () => {
    hoisted.profileFindUnique.mockResolvedValueOnce({ role: 'STUDENT' });

    const response = await GET(request());

    expect(response.status).toBe(403);
    expect(hoisted.resolveOwnedProvider).not.toHaveBeenCalled();
    expect(hoisted.bookingCount).not.toHaveBeenCalled();
  });

  it.each(['INSTRUCTOR', 'HANDLEDARE'])('supports the %s provider role', async (role) => {
    hoisted.profileFindUnique.mockResolvedValueOnce({ role });
    hoisted.resolveOwnedProvider.mockResolvedValueOnce({ ...provider, providerRole: role });
    hoisted.bookingCount.mockResolvedValueOnce(2);
    hoisted.bookingFindMany.mockResolvedValueOnce([lesson()]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      count: 2,
      providerRole: role,
      items: [
        {
          id: 'booking_1',
          learnerName: 'Learner',
          category: 'B',
          lessonDate: '2026-08-27T10:00:00.000Z',
          completionDate: '2026-08-28T12:00:00.000Z',
        },
      ],
    });
    expect(hoisted.resolveOwnedProvider).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_provider' }),
      ['INSTRUCTOR', 'HANDLEDARE'],
    );
  });

  it('queries only released, completed, non-cancelled, undisputed bookings and limits recent rows', async () => {
    hoisted.bookingCount.mockResolvedValueOnce(7);
    hoisted.bookingFindMany.mockResolvedValueOnce([
      lesson({ id: 'booking_newest', completedAt: new Date('2026-08-30T12:00:00.000Z') }),
      lesson({ id: 'booking_next', completedAt: new Date('2026-08-29T12:00:00.000Z') }),
    ]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    const where = {
      instructorId: 'instructor_1',
      completedAt: { not: null },
      paymentStatus: 'released',
      cancelledAt: null,
      cancellationOutcome: null,
      disputeStatus: null,
    };
    expect(hoisted.bookingCount).toHaveBeenCalledWith({ where });
    expect(hoisted.bookingFindMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: 5,
      select: {
        id: true,
        studentName: true,
        category: true,
        preferredAt: true,
        completedAt: true,
      },
    });
    expect((await response.json()).items.map((item: { id: string }) => item.id)).toEqual([
      'booking_newest',
      'booking_next',
    ]);
  });

  it('returns a zero result for a provider role without a marketplace listing', async () => {
    hoisted.profileFindUnique.mockResolvedValueOnce({ role: 'HANDLEDARE' });
    hoisted.resolveOwnedProvider.mockResolvedValueOnce(null);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 0, providerRole: 'HANDLEDARE', items: [] });
    expect(hoisted.bookingCount).not.toHaveBeenCalled();
  });

  it('returns an empty list when the owned provider has no completed lessons', async () => {
    hoisted.bookingCount.mockResolvedValueOnce(0);
    hoisted.bookingFindMany.mockResolvedValueOnce([]);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ count: 0, providerRole: 'INSTRUCTOR', items: [] });
  });
});
