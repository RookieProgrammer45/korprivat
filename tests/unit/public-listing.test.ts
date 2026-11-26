import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockInstructorFindFirst,
  mockInstructorFindUnique,
  mockLicenseFindUnique,
  mockLoadPublicListingById,
} = vi.hoisted(() => ({
  mockInstructorFindFirst: vi.fn(),
  mockInstructorFindUnique: vi.fn(),
  mockLicenseFindUnique: vi.fn(),
  mockLoadPublicListingById: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: {
      findMany: async () => [],
      findFirst: mockInstructorFindFirst,
      findUnique: mockInstructorFindUnique,
    },
    instructorLicense: {
      findMany: async () => [],
      findUnique: mockLicenseFindUnique,
    },
  },
}));
vi.mock('@/lib/discovery/public-listing', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/discovery/public-listing')>();
  return {
    ...actual,
    loadPublicListingById: mockLoadPublicListingById,
  };
});

import { nordicInstructorById } from '@/lib/discovery/nordic-catalogue';
import { cityListingStats, omitListingReviewBodies } from '@/lib/discovery/public-listing';
import { serializeJsonLd } from '@/lib/seo/json-ld';
import { loadPublicInstructorBySchoolSlug } from '@/lib/seo/public-instructor';
import { schoolPath } from '@/lib/seo/school-slugs';

const UP = 'euese44ca3-k-dos';

describe('omitListingReviewBodies', () => {
  it('strips review text and leaves ratings', () => {
    const item = {
      id: 'school_1',
      googleRating: 4.7,
      googleReviewCount: 12,
      googleReviews: [{ id: 'r1', authorName: 'A', rating: 5, comment: 'Bra', relativeTime: null }],
    };
    expect(omitListingReviewBodies(item)).toEqual({
      id: 'school_1',
      googleRating: 4.7,
      googleReviewCount: 12,
    });
  });
});

describe('cityListingStats', () => {
  it('reports count and price facts from published lessons only', () => {
    expect(
      cityListingStats([
        {
          publishedPrices: {
            lesson: { priceSek: 800, minutes: 40 },
            collectedAt: '2026-01-01',
          },
        },
        {
          publishedPrices: {
            lesson: { priceSek: 600, minutes: 40 },
            collectedAt: '2026-03-01',
          },
        },
        { publishedPrices: null },
      ]),
    ).toEqual({
      count: 3,
      minLessonSek: 600,
      medianLessonSek: 700,
      typicalMinutes: 40,
      latestCollectedAt: '2026-03-01',
    });
  });

  it('returns null price facts when no lesson prices exist', () => {
    expect(cityListingStats([{ publishedPrices: null }])).toEqual({
      count: 1,
      minLessonSek: null,
      medianLessonSek: null,
      typicalMinutes: null,
      latestCollectedAt: null,
    });
  });
});

describe('serializeJsonLd', () => {
  it('escapes < so a payload cannot break out of the script tag', () => {
    expect(serializeJsonLd({ name: '</script><img src=x onerror=alert(1)>' })).toContain('\\u003c');
    expect(serializeJsonLd({ name: '</script>' })).not.toContain('</script>');
  });
});

describe('loadPublicInstructorBySchoolSlug', () => {
  beforeEach(() => {
    mockInstructorFindFirst.mockReset();
    mockInstructorFindUnique.mockReset();
    mockLicenseFindUnique.mockReset();
    mockLoadPublicListingById.mockReset();
  });

  it('keeps catalogue profiles self-contained for anonymous visitors', async () => {
    const school = nordicInstructorById(UP);
    if (!school) throw new Error('missing catalogue school');
    const slug = schoolPath(school).split('/').pop() ?? '';
    const resolved = await loadPublicInstructorBySchoolSlug(slug);
    expect(resolved?.listing?.id).toBe(UP);
    expect(resolved?.instructor.catalogue).toBe(true);
  });

  it('attaches a Swedish listing so anonymous profile pages can render', async () => {
    const id = '412ef740-ca24-43bc-8f4f-06ba568ffc37';
    mockInstructorFindFirst.mockResolvedValue({ id });
    mockInstructorFindUnique.mockResolvedValue({
      id,
      userId: 'user_school',
      name: 'Alingsås Trafikskola AB',
      city: 'Alingsås',
      bio: 'Körlektioner i Alingsås.',
      hourlyRateSek: 0,
      categories: ['B'],
      photoUrl: '',
      englishSpeaking: false,
      providerRole: 'SCHOOL',
      bookingMode: 'contact',
    });
    mockLicenseFindUnique.mockResolvedValue({ status: 'VERIFIED' });
    mockLoadPublicListingById.mockResolvedValue({
      id,
      name: 'Alingsås Trafikskola AB',
      city: 'Alingsås',
    });

    const resolved = await loadPublicInstructorBySchoolSlug('alingsas-trafikskola-ab-412ef740');
    expect(resolved?.instructor.name).toBe('Alingsås Trafikskola AB');
    expect(resolved?.listing).toMatchObject({ id, name: 'Alingsås Trafikskola AB' });
    expect(mockLoadPublicListingById).toHaveBeenCalledWith(id);
  });
});
