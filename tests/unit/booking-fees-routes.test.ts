import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst, mockFindUnique, mockRequireAuth } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findFirst: mockFindFirst, findUnique: mockFindUnique },
  },
}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));

import { GET as configGET } from '@/app/api/booking-fees/config/route';
import { GET as quoteGET } from '@/app/api/booking-fees/quote/route';

describe('GET /api/booking-fees/quote', () => {
  it('returns the school price with no separate learner fee', async () => {
    mockFindUnique.mockResolvedValueOnce({ hourlyRateSek: 550 });
    const response = await quoteGET(
      new Request('http://localhost/api/booking-fees/quote?instructorId=instructor_erik'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      priceAmountSek: 550,
      serviceFeeSek: 0,
      grossChargedSek: 550,
    });
  });

  it('rejects a missing instructor id', async () => {
    const response = await quoteGET(new Request('http://localhost/api/booking-fees/quote'));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the instructor no longer exists', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    const response = await quoteGET(
      new Request('http://localhost/api/booking-fees/quote?instructorId=missing'),
    );
    expect(response.status).toBe(404);
  });
});

describe('GET /api/booking-fees/config', () => {
  beforeEach(() => {
    mockFindFirst.mockReset();
    mockFindUnique.mockReset();
    mockRequireAuth.mockReset();
  });

  it('requires an authenticated session', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));

    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));

    expect(response.status).toBe(401);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('requires the authenticated user to have an instructor profile', async () => {
    mockRequireAuth.mockResolvedValueOnce({ id: 'user_learner' });
    mockFindFirst.mockResolvedValueOnce(null);

    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      errors: { account: 'Instructor account required' },
    });
  });

  it('returns provider fee configuration only after the profile check', async () => {
    mockRequireAuth.mockResolvedValueOnce({ id: 'user_provider' });
    mockFindFirst.mockResolvedValueOnce({ id: 'instructor_provider' });

    const response = await configGET(new Request('http://localhost/api/booking-fees/config'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      serviceFeePercent: 0,
      commissionPercent: 10,
      schoolCommissionPercent: 8,
    });
  });
});
