import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted mock factories — these run BEFORE any module imports so that the
// `vi.mock('@/lib/db', ...)` / `vi.mock('server-only', ...)` calls below can
// resolve to them. We mock the prisma client at the level of the two
// findMany calls the GET handler needs: `instructor` for the filtered list,
// and `availabilitySlot` for the upcoming-slot projection.
const {
  mockInstructorFindMany,
  mockSlotFindMany,
  mockLicenseFindMany,
  mockReviewFindMany,
  mockGetSessionUser,
} = vi.hoisted(() => ({
  mockInstructorFindMany: vi.fn(),
  mockSlotFindMany: vi.fn(),
  mockLicenseFindMany: vi.fn(),
  mockReviewFindMany: vi.fn(),
  mockGetSessionUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findMany: mockInstructorFindMany },
    availabilitySlot: { findMany: mockSlotFindMany },
    instructorLicense: { findMany: mockLicenseFindMany },
    review: { findMany: mockReviewFindMany },
  },
}));

// `server-only` is a Next-time side-effect guard that throws on the client
// bundle. It isn't installed at the package root in this app's tree, and
// vitest runs without Next's resolver; emulate the package as a 1-line stub
// so the route handler's `import 'server-only'` line can be unit-tested.
vi.mock('server-only', () => ({}));
vi.mock('@/lib/require-auth', () => ({ getSessionUser: mockGetSessionUser }));

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/instructors/route';

function req(query = ''): NextRequest {
  return new NextRequest(
    new Request(`http://localhost/api/instructors${query}`, { method: 'GET' }),
  );
}

function instructorRow(
  overrides: Partial<{
    id: string;
    name: string;
    city: string;
    categories: string[];
    hourlyRateSek: number;
    bio: string;
    photoUrl: string;
    bookedHours: number;
    englishSpeaking: boolean;
    latitude: number | null;
    longitude: number | null;
    serviceArea: string | null;
    userId: string | null;
    cancellationPolicyTier: string | null;
    bookingMode: 'instant' | 'request' | null;
  }> = {},
) {
  return {
    id: 'instructor_erik',
    name: 'Erik Lindqvist',
    city: 'Stockholm',
    categories: ['B', 'A2'],
    hourlyRateSek: 550,
    bio: 'Bio text',
    photoUrl: 'https://cdn.example.test/erik.jpg',
    bookedHours: 12,
    englishSpeaking: true,
    latitude: null,
    longitude: null,
    serviceArea: null,
    userId: null,
    cancellationPolicyTier: 'flexible',
    bookingMode: 'instant',
    ...overrides,
  };
}

describe('GET /api/instructors — next-open-slot projection', () => {
  beforeEach(() => {
    mockInstructorFindMany.mockReset();
    mockSlotFindMany.mockReset();
    mockLicenseFindMany.mockReset();
    mockReviewFindMany.mockReset();
    mockSlotFindMany.mockResolvedValue([]);
    mockLicenseFindMany.mockResolvedValue([]);
    mockReviewFindMany.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches non-null nextSlotAt for an instructor with an upcoming open slot', async () => {
    const instructorId = 'instructor_erik';
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow({ id: instructorId })]);
    // The handler orders ascending and inlines `new Date()` as the cutoff.
    // We return one row whose startsAt lands in the future — the handler
    // serialises the FIRST occurrence per id as that instructor's earliest.
    mockSlotFindMany.mockResolvedValueOnce([
      {
        instructorId,
        startsAt: new Date('2030-01-15T18:30:00.000Z'),
      },
    ]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; nextSlotAt: string | null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]?.nextSlotAt).toBe('2030-01-15T18:30:00.000Z');
    expect(body.items[0]).not.toHaveProperty('bookedHours');
    expect(mockSlotFindMany).toHaveBeenCalledOnce();
  });

  it('attaches null nextSlotAt for an instructor with no upcoming open slot', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow({ id: 'instructor_anna' })]);
    // Either returns [] or the handler's `bookedAt: null && startsAt > now`
    // filter swallows the row in the real DB; either way the projection map
    // stays empty and `nextSlotAt` ends up `null`.
    mockSlotFindMany.mockResolvedValueOnce([]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string; nextSlotAt: string | null }> };
    expect(body.items[0]?.nextSlotAt).toBeNull();
  });

  it('keeps the earliest startsAt per instructor when several slots are returned', async () => {
    const aId = 'a';
    const bId = 'b';
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({ id: aId, name: 'Anna', city: 'Göteborg' }),
      instructorRow({ id: bId, name: 'Bertil', city: 'Malmö' }),
    ]);
    mockSlotFindMany.mockResolvedValueOnce([
      { instructorId: bId, startsAt: new Date('2030-04-01T09:00:00.000Z') },
      { instructorId: aId, startsAt: new Date('2030-02-05T10:00:00.000Z') },
      { instructorId: aId, startsAt: new Date('2030-03-10T11:00:00.000Z') },
    ]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; nextSlotAt: string | null }>;
    };
    const byId = Object.fromEntries(body.items.map((i) => [i.id, i.nextSlotAt]));
    expect(byId[aId]).toBe('2030-02-05T10:00:00.000Z');
    expect(byId[bId]).toBe('2030-04-01T09:00:00.000Z');
  });

  it('returns the responding cities only — null nextSlotAt per row, no slot query', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({ id: 'one', city: 'Stockholm' }),
      instructorRow({ id: 'two', city: 'Göteborg' }),
    ]);
    mockSlotFindMany.mockResolvedValueOnce([]);

    const res = await GET(req());
    const body = (await res.json()) as {
      items: Array<{ nextSlotAt: string | null }>;
      cities: string[];
    };
    expect(body.items.every((i) => i.nextSlotAt === null)).toBe(true);
    expect(body.cities).toEqual(['Göteborg', 'Stockholm']);
  });

  it('returns safe profile facts with coarse verification and review aggregates', async () => {
    const instructorId = 'instructor_verified';
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({
        id: instructorId,
        serviceArea: 'Södermalm + 15 km',
        userId: 'user_verified',
        bookingMode: 'request',
      }),
    ]);
    mockSlotFindMany.mockResolvedValueOnce([]);
    mockLicenseFindMany.mockResolvedValueOnce([{ userId: 'user_verified', status: 'VERIFIED' }]);
    mockReviewFindMany.mockResolvedValueOnce([
      { instructorId, rating: 5 },
      { instructorId, rating: 4 },
      { instructorId, rating: 99 },
    ]);

    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(body.items[0]).toMatchObject({
      serviceArea: 'Södermalm + 15 km',
      languages: ['sv', 'en'],
      verificationStatus: 'verified',
      reviewSummary: { count: 2, averageRating: 4.5 },
      bookingMode: 'request',
    });
    expect(body.items[0]).not.toHaveProperty('userId');
  });

  it('applies an inclusive minimum hourly rate filter', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow()]);

    const res = await GET(req('?minRate=500'));

    expect(res.status).toBe(200);
    expect(mockInstructorFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hourlyRateSek: { gte: 500 } },
    });
  });

  it('keeps the maximum hourly rate filter as an inclusive upper bound', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow()]);

    const res = await GET(req('?maxRate=600'));

    expect(res.status).toBe(200);
    expect(mockInstructorFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hourlyRateSek: { lte: 600 } },
    });
  });

  it('combines inclusive hourly rate bounds into one Prisma condition', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow()]);

    const res = await GET(req('?minRate=500&maxRate=600'));

    expect(res.status).toBe(200);
    expect(mockInstructorFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hourlyRateSek: { gte: 500, lte: 600 } },
    });
  });

  it('combines the rate range with the existing city, category, and language filters', async () => {
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow()]);

    const res = await GET(req('?city=Stockholm&categories=B&english=true&minRate=500&maxRate=600'));

    expect(res.status).toBe(200);
    const call = mockInstructorFindMany.mock.calls[0]?.[0] as {
      where: {
        OR: Array<{ categories: { has: string } }>;
        city: string;
        englishSpeaking: boolean;
      } & {
        hourlyRateSek: { gte: number; lte: number };
      };
    };
    expect(call.where).toMatchObject({
      city: 'Stockholm',
      englishSpeaking: true,
      hourlyRateSek: { gte: 500, lte: 600 },
    });
    expect(call.where.OR).toEqual([{ categories: { has: 'B' } }]);
  });

  it('keeps instructors at or above the inclusive minimum rating threshold', async () => {
    const highId = 'high-rated';
    const lowId = 'low-rated';
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({ id: highId, name: 'High rated' }),
      instructorRow({ id: lowId, name: 'Low rated' }),
    ]);
    mockReviewFindMany.mockResolvedValueOnce([
      { instructorId: highId, rating: 4 },
      { instructorId: highId, rating: 4 },
      { instructorId: lowId, rating: 3 },
      { instructorId: lowId, rating: 4 },
    ]);

    const res = await GET(req('?minRating=4'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual([highId]);
  });

  it('rejects malformed and unsupported rating and availability values', async () => {
    const invalidRating = await GET(req('?minRating=4.25'));
    expect(invalidRating.status).toBe(400);
    expect(await invalidRating.json()).toEqual({
      errors: { minRating: 'Rating must use half-star increments' },
    });

    const invalidAvailability = await GET(req('?availability=evening'));
    expect(invalidAvailability.status).toBe(400);
    expect(await invalidAvailability.json()).toMatchObject({
      errors: { availability: expect.any(String) },
    });
    expect(mockInstructorFindMany).not.toHaveBeenCalled();
  });

  it('matches weekday slots in the provider timezone and projects the matching next slot', async () => {
    const weekdayId = 'weekday-instructor';
    const weekendId = 'weekend-instructor';
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({ id: weekdayId, name: 'Weekday', city: 'Stockholm' }),
      instructorRow({ id: weekendId, name: 'Weekend', city: 'Stockholm' }),
    ]);
    const monday = new Date('2030-01-14T10:00:00.000Z');
    const saturday = new Date('2030-01-19T10:00:00.000Z');
    mockSlotFindMany.mockResolvedValueOnce([
      { instructorId: weekendId, startsAt: saturday },
      { instructorId: weekdayId, startsAt: monday },
    ]);

    const res = await GET(req('?availability=weekday'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; nextSlotAt: string | null }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: weekdayId, nextSlotAt: monday.toISOString() });
  });

  it('matches weekend slots without advertising a weekday slot', async () => {
    const weekdayId = 'weekday-instructor';
    const weekendId = 'weekend-instructor';
    mockInstructorFindMany.mockResolvedValueOnce([
      instructorRow({ id: weekdayId, name: 'Weekday', city: 'Stockholm' }),
      instructorRow({ id: weekendId, name: 'Weekend', city: 'Stockholm' }),
    ]);
    const monday = new Date('2030-01-14T10:00:00.000Z');
    const saturday = new Date('2030-01-19T10:00:00.000Z');
    mockSlotFindMany.mockResolvedValueOnce([
      { instructorId: weekdayId, startsAt: monday },
      { instructorId: weekendId, startsAt: saturday },
    ]);

    const res = await GET(req('?availability=weekend'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ id: string; nextSlotAt: string | null }>;
    };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ id: weekendId, nextSlotAt: saturday.toISOString() });
  });

  it('composes price, rating, and availability filters with an AND result', async () => {
    const instructorId = 'matching-instructor';
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow({ id: instructorId })]);
    mockReviewFindMany.mockResolvedValueOnce([
      { instructorId, rating: 5 },
      { instructorId, rating: 4 },
    ]);
    const monday = new Date('2030-01-14T10:00:00.000Z');
    mockSlotFindMany.mockResolvedValueOnce([{ instructorId, startsAt: monday }]);

    const res = await GET(req('?maxRate=550&minRating=4.5&availability=weekday'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: Array<{ id: string }> };
    expect(body.items.map((item) => item.id)).toEqual([instructorId]);
    expect(mockInstructorFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: { hourlyRateSek: { lte: 550 } },
    });
  });

  it('returns zero items when no valid review meets the rating threshold', async () => {
    const instructorId = 'unrated-instructor';
    mockInstructorFindMany.mockResolvedValueOnce([instructorRow({ id: instructorId })]);
    mockReviewFindMany.mockResolvedValueOnce([{ instructorId, rating: 99 }]);

    const res = await GET(req('?minRating=3'));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; cities: string[] };
    expect(body.items).toEqual([]);
    expect(body.cities).toEqual(['Stockholm']);
  });

  it('rejects a minimum hourly rate above the maximum with the standard error envelope', async () => {
    const res = await GET(req('?minRate=700&maxRate=600'));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      errors: { minRate: 'Minimum rate cannot exceed maximum rate' },
    });
    expect(mockInstructorFindMany).not.toHaveBeenCalled();
  });
});
