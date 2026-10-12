import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUnique: vi.fn(),
  findSlot: vi.fn(),
  eligible: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findFirst: mocks.findFirst, findUnique: mocks.findUnique },
    availabilitySlot: { findFirst: mocks.findSlot },
  },
}));
vi.mock('@/lib/business/provider-activation', () => ({ isPublicBookableProvider: mocks.eligible }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));

import { GET as configGET } from '@/app/api/booking-fees/config/route';
import { GET as quoteGET } from '@/app/api/booking-fees/quote/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eligible.mockResolvedValue(true);
  mocks.findUnique.mockResolvedValue({ hourlyRateSek: 550, userId: 'provider', categories: ['B'] });
  mocks.findSlot.mockResolvedValue({ durationMinutes: 60 });
});

function quoteRequest(query = 'instructorId=instructor_erik&slotId=slot_1') {
  return new Request(`http://localhost/api/booking-fees/quote?${query}`);
}

describe('GET /api/booking-fees/quote', () => {
  it('returns the selected lesson price with no separate learner fee', async () => {
    const response = await quoteGET(quoteRequest());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      priceAmountSek: 550,
      serviceFeeSek: 0,
      grossChargedSek: 550,
    });
    expect(mocks.findSlot).toHaveBeenCalledWith({
      where: {
        id: 'slot_1',
        instructorId: 'instructor_erik',
        bookedAt: null,
        startsAt: { gt: expect.any(Date) },
      },
      select: { durationMinutes: true },
    });
  });

  it.each([40, 45, 90])(
    'quotes a %i-minute slot using server duration, not an invented client total',
    async (duration) => {
      mocks.findSlot.mockResolvedValueOnce({ durationMinutes: duration });
      const response = await quoteGET(
        quoteRequest(
          'instructorId=instructor_erik&slotId=slot_1&priceAmountSek=1&durationMinutes=1',
        ),
      );
      const price = Math.round((550 * duration) / 60);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        priceAmountSek: price,
        serviceFeeSek: 0,
        grossChargedSek: price,
      });
    },
  );

  it.each(['', 'slotId=slot_1', 'instructorId=instructor_erik'])(
    'rejects an incomplete selected-slot quote (%s)',
    async (query) => {
      const response = await quoteGET(quoteRequest(query));
      expect(response.status).toBe(400);
      expect(mocks.findUnique).not.toHaveBeenCalled();
      expect(mocks.findSlot).not.toHaveBeenCalled();
    },
  );

  it('returns 404 when the instructor no longer exists', async () => {
    mocks.findUnique.mockResolvedValueOnce(null);
    const response = await quoteGET(quoteRequest('instructorId=missing&slotId=slot_1'));
    expect(response.status).toBe(404);
    expect(mocks.findSlot).not.toHaveBeenCalled();
  });

  it('returns 404 without exposing slots for an unbookable provider', async () => {
    mocks.eligible.mockResolvedValueOnce(false);
    const response = await quoteGET(quoteRequest());
    expect(response.status).toBe(404);
    expect(mocks.findSlot).not.toHaveBeenCalled();
  });

  it('returns 404 for a missing, taken, past or other-provider slot', async () => {
    mocks.findSlot.mockResolvedValueOnce(null);
    const response = await quoteGET(quoteRequest());
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ errors: { slotId: 'Slot no longer available' } });
  });
});

describe('GET /api/booking-fees/config', () => {
  it('requires an authenticated session', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));
    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));
    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('requires the authenticated user to have an instructor profile', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ id: 'user_learner' });
    mocks.findFirst.mockResolvedValueOnce(null);
    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ errors: { account: 'Instructor account required' } });
  });

  it('returns provider fee configuration only after the profile check', async () => {
    mocks.requireAuth.mockResolvedValueOnce({ id: 'user_provider' });
    mocks.findFirst.mockResolvedValueOnce({ id: 'instructor_provider' });
    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      serviceFeePercent: 0,
      commissionPercent: 10,
      schoolCommissionPercent: 8,
    });
  });
});
