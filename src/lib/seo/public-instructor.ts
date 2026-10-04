import 'server-only';
import { isProviderActivated, isMarketplaceSchoolRole } from '@/lib/business/provider-activation';
import { prisma } from '@/lib/db';

export type PublicInstructorSeo = {
  id: string;
  name: string;
  city: string;
  bio: string;
  hourlyRateSek: number;
  categories: string[];
  photoUrl: string;
  englishSpeaking: boolean;
  indexable: boolean;
};

export async function loadPublicInstructorSeo(id: string): Promise<PublicInstructorSeo | null> {
  const row = await prisma.instructor.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      city: true,
      bio: true,
      hourlyRateSek: true,
      categories: true,
      photoUrl: true,
      englishSpeaking: true,
      providerRole: true,
    },
  });
  if (!row) return null;

  const license = row.userId
    ? await prisma.instructorLicense.findUnique({
        where: { userId: row.userId },
        select: { status: true },
      })
    : null;

  const indexable =
    isProviderActivated(row.categories) &&
    isMarketplaceSchoolRole(row.providerRole) &&
    license?.status === 'VERIFIED';

  return {
    id: row.id,
    name: row.name,
    city: row.city,
    bio: row.bio,
    hourlyRateSek: row.hourlyRateSek,
    categories: row.categories,
    photoUrl: row.photoUrl,
    englishSpeaking: row.englishSpeaking,
    indexable,
  };
}

/** Verified marketplace listings for sitemap (cap keeps build bounded). */
export async function listIndexableInstructorIds(limit = 500): Promise<string[]> {
  const verified = await prisma.instructorLicense.findMany({
    where: { status: 'VERIFIED' },
    select: { userId: true },
    take: limit,
  });
  if (verified.length === 0) return [];
  const rows = await prisma.instructor.findMany({
    where: {
      userId: { in: verified.map((v) => v.userId) },
      OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
    },
    select: { id: true, categories: true },
    take: limit,
  });
  return rows.filter((r) => isProviderActivated(r.categories)).map((r) => r.id);
}
