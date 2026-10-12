import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInstructorFindUnique,
  mockLicenseFindFirst,
  mockLicenseFindMany,
  mockReviewFindMany,
  mockSlotFindFirst,
  mockSlotFindMany,
  mockGetActiveAffiliationForUser,
} = vi.hoisted(() => ({
  mockInstructorFindUnique: vi.fn(),
  mockLicenseFindFirst: vi.fn(),
  mockLicenseFindMany: vi.fn(),
  mockReviewFindMany: vi.fn(),
  mockSlotFindFirst: vi.fn(),
  mockSlotFindMany: vi.fn(),
  mockGetActiveAffiliationForUser: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findUnique: mockInstructorFindUnique },
    instructorLicense: {
      findFirst: mockLicenseFindFirst,
      findMany: mockLicenseFindMany,
    },
    review: { findMany: mockReviewFindMany },
    availabilitySlot: {
      findFirst: mockSlotFindFirst,
      findMany: mockSlotFindMany,
    },
  },
}));
vi.mock('@/lib/orgs/public', () => ({
  getActiveAffiliationForUser: mockGetActiveAffiliationForUser,
}));
vi.mock('server-only', () => ({}));

import { GET as availabilityGET } from '@/app/api/instructors/[id]/availability/route';
import { GET as detailGET } from '@/app/api/instructors/[id]/route';
import { isPublicBookableProvider } from '@/lib/business/provider-activation';

type LicenceStatus = 'VERIFIED' | 'EXPIRED' | 'PENDING' | 'REJECTED';

function context() {
  return { params: Promise.resolve({ id: 'instructor_public' }) };
}

function publicInstructor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instructor_public',
    name: 'Erik Lindqvist',
    city: 'Stockholm',
    serviceArea: null,
    categories: ['B'],
    hourlyRateSek: 550,
    bio: 'Certified driving instructor',
    photoUrl: 'https://cdn.example.test/erik.jpg',
    englishSpeaking: true,
    latitude: null,
    longitude: null,
    userId: 'user_provider',
    cancellationPolicyTier: 'flexible',
    bookingMode: 'instant',
    providerRole: 'INSTRUCTOR',
    ...overrides,
  };
}

function setLicenceStatus(status: LicenceStatus, expiresAt: Date | null = null) {
  mockLicenseFindFirst.mockImplementation(
    ({ where }: { where: { status: string; OR?: Array<{ expiresAt: null | { gt: Date } }> } }) => {
      const expiryMatches =
        !where.OR ||
        where.OR.some((part) =>
          part.expiresAt === null
            ? expiresAt === null
            : expiresAt !== null && expiresAt > part.expiresAt.gt,
        );
      return where.status === status && expiryMatches ? { id: 'licence_public' } : null;
    },
  );
  mockLicenseFindMany.mockResolvedValue([{ userId: 'user_provider', status }]);
}

describe('public-bookable provider eligibility', () => {
  beforeEach(() => {
    mockInstructorFindUnique.mockReset();
    mockLicenseFindFirst.mockReset();
    mockLicenseFindMany.mockReset();
    mockReviewFindMany.mockReset();
    mockSlotFindFirst.mockReset();
    mockSlotFindMany.mockReset();
    mockGetActiveAffiliationForUser.mockReset();
    mockReviewFindMany.mockResolvedValue([]);
    mockSlotFindFirst.mockResolvedValue(null);
    mockSlotFindMany.mockResolvedValue([]);
    mockGetActiveAffiliationForUser.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows a canonical non-HANDLEDARE provider only with a VERIFIED licence', async () => {
    setLicenceStatus('VERIFIED');

    await expect(
      isPublicBookableProvider({
        userId: 'user_provider',
        categories: ['B'],
        providerRole: 'INSTRUCTOR',
      }),
    ).resolves.toBe(true);
    expect(mockLicenseFindFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user_provider',
        status: 'VERIFIED',
        OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }],
      },
      select: { id: true },
    });
  });

  it('denies a VERIFIED-but-expired document immediately, even before the cron updates its status', async () => {
    setLicenceStatus('VERIFIED', new Date(Date.now() - 1000));
    mockInstructorFindUnique.mockResolvedValue(publicInstructor());
    expect(
      (
        await detailGET(
          new Request('http://localhost/api/instructors/instructor_public'),
          context(),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await availabilityGET(
          new Request('http://localhost/api/instructors/instructor_public/availability'),
          context(),
        )
      ).status,
    ).toBe(404);
    expect(mockSlotFindMany).not.toHaveBeenCalled();
  });

  it('denies a provider without a linked user before querying licences', async () => {
    await expect(
      isPublicBookableProvider({ userId: null, categories: ['B'], providerRole: 'INSTRUCTOR' }),
    ).resolves.toBe(false);
    expect(mockLicenseFindFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['EXPIRED licence', 'EXPIRED', { providerRole: 'INSTRUCTOR' }],
    ['PENDING licence', 'PENDING', { providerRole: 'INSTRUCTOR' }],
    ['REJECTED licence', 'REJECTED', { providerRole: 'INSTRUCTOR' }],
    ['HANDLEDARE with a VERIFIED licence', 'VERIFIED', { providerRole: 'HANDLEDARE' }],
  ] as const)(
    'does not expose profile facts or availability for a provider with %s',
    async (_caseName, licenceStatus, overrides) => {
      setLicenceStatus(licenceStatus);
      mockInstructorFindUnique.mockResolvedValue(publicInstructor(overrides));

      const detail = await detailGET(
        new Request('http://localhost/api/instructors/instructor_public'),
        context(),
      );
      expect(detail.status).toBe(404);
      await expect(detail.json()).resolves.toEqual({ errors: { id: 'Not found' } });
      expect(mockSlotFindFirst).not.toHaveBeenCalled();
      expect(mockGetActiveAffiliationForUser).not.toHaveBeenCalled();

      const availability = await availabilityGET(
        new Request('http://localhost/api/instructors/instructor_public/availability'),
        context(),
      );
      expect(availability.status).toBe(404);
      await expect(availability.json()).resolves.toEqual({ errors: { id: 'Provider not found' } });
      expect(mockSlotFindMany).not.toHaveBeenCalled();
    },
  );

  it('returns the public profile and open availability for a VERIFIED instructor', async () => {
    setLicenceStatus('VERIFIED');
    mockInstructorFindUnique.mockResolvedValue(publicInstructor());
    mockSlotFindFirst.mockResolvedValue({ startsAt: new Date('2030-01-15T18:30:00.000Z') });
    mockSlotFindMany.mockResolvedValue([
      {
        id: 'slot_public',
        instructorId: 'instructor_public',
        startsAt: new Date('2030-01-15T18:30:00.000Z'),
        endsAt: new Date('2030-01-15T19:30:00.000Z'),
        durationMinutes: 60,
        bookedAt: null,
      },
    ]);

    const detail = await detailGET(
      new Request('http://localhost/api/instructors/instructor_public'),
      context(),
    );
    expect(detail.status).toBe(200);
    expect((await detail.json()).id).toBe('instructor_public');

    const availability = await availabilityGET(
      new Request('http://localhost/api/instructors/instructor_public/availability'),
      context(),
    );
    expect(availability.status).toBe(200);
    expect((await availability.json()).items).toHaveLength(1);
    expect(mockSlotFindMany).toHaveBeenCalledOnce();
  });
});
