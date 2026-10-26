//
// When a school invite is accepted, the instructor gets a catalogue listing
// that inherits the school's public city, categories and price. Identity
// verification is not copied from the school — they appear because they
// belong to a catalogue-eligible school.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';

const SCHOOL_LISTING_SELECT = {
  id: true,
  name: true,
  city: true,
  serviceArea: true,
  categories: true,
  hourlyRateSek: true,
  photoUrl: true,
  englishSpeaking: true,
  latitude: true,
  longitude: true,
  bookingMode: true,
  cancellationPolicyTier: true,
  providerRole: true,
} as const;

export async function publishSchoolStaffListing(input: {
  organizationId: string;
  userId: string;
}): Promise<{ created: boolean; listingId: string | null }> {
  const existing = await prisma.instructor.findMany({
    where: { userId: input.userId, providerRole: { not: 'HANDLEDARE' } },
    select: { id: true },
    take: 1,
  });
  if (existing[0]) return { created: false, listingId: existing[0].id };

  const school = await findSchoolListing(input.organizationId);
  if (!school) return { created: false, listingId: null };

  const [user, org] = await Promise.all([
    prisma.user.findUnique({
      where: { id: input.userId },
      select: { id: true, name: true, email: true },
    }),
    prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { id: true, name: true },
    }),
  ]);
  if (!user) return { created: false, listingId: null };

  const name = user.name?.trim() || user.email.split('@')[0] || org?.name || 'Instruktör';
  const created = await prisma.instructor.create({
    data: {
      id: randomUUID(),
      name,
      city: school.city,
      ...(school.serviceArea ? { serviceArea: school.serviceArea } : {}),
      categories: school.categories,
      hourlyRateSek: school.hourlyRateSek,
      bio: org?.name ? `Undervisar hos ${org.name}.` : '',
      photoUrl: school.photoUrl,
      email: user.email.trim().toLowerCase(),
      englishSpeaking: school.englishSpeaking,
      latitude: school.latitude,
      longitude: school.longitude,
      userId: input.userId,
      providerRole: 'INSTRUCTOR',
      bookingMode: 'contact',
      cancellationPolicyTier: school.cancellationPolicyTier ?? 'flexible',
    },
  });
  return { created: true, listingId: created.id };
}

async function findSchoolListing(organizationId: string) {
  const binding = await prisma.listingOrgBinding.findFirst({
    where: { organizationId, state: 'ACTIVE' },
    select: { listingId: true },
  });
  if (binding) {
    const bound = await prisma.instructor.findFirst({
      where: { id: binding.listingId, providerRole: { not: 'HANDLEDARE' } },
      select: SCHOOL_LISTING_SELECT,
    });
    if (bound) return bound;
  }

  const owners = await prisma.membership.findMany({
    where: { organizationId, role: 'OWNER', status: 'ACTIVE' },
    select: { userId: true },
  });
  const ownerIds = owners.map((row) => row.userId).filter(Boolean);
  if (ownerIds.length > 0) {
    const owned = await prisma.instructor.findFirst({
      where: {
        userId: { in: ownerIds },
        providerRole: { not: 'HANDLEDARE' },
      },
      select: SCHOOL_LISTING_SELECT,
      orderBy: { name: 'asc' },
    });
    if (owned) return owned;
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { contactEmail: true },
  });
  const email = org?.contactEmail?.trim().toLowerCase();
  if (!email) return null;
  return prisma.instructor.findFirst({
    where: {
      email: { equals: email, mode: 'insensitive' },
      providerRole: { not: 'HANDLEDARE' },
    },
    select: SCHOOL_LISTING_SELECT,
  });
}
