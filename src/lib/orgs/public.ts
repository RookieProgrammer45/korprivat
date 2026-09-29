import 'server-only';
import type { Organization, Prisma } from '@prisma/client';
import { buildProviderActivationWhere } from '@/lib/business/provider-activation';
import { PUBLIC_INSTRUCTOR_SELECT } from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';

export type SchoolAffiliation = {
  organizationId: string;
  name: string;
  slug: string;
};

export type SchoolListedInstructor = Prisma.InstructorGetPayload<{
  select: typeof PUBLIC_INSTRUCTOR_SELECT;
}>;

/**
 * First ACTIVE Membership for a user, ordered by createdAt.
 * // Multi-org: show first by createdAt. Revisit if any user has >1
 * // ACTIVE membership.
 */
export async function getActiveAffiliationForUser(
  userId: string | null | undefined,
): Promise<SchoolAffiliation | null> {
  if (!userId) return null;
  const membership = await prisma.membership.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
    select: {
      organizationId: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  if (!membership) return null;
  return {
    organizationId: membership.organizationId,
    name: membership.organization.name,
    slug: membership.organization.slug,
  };
}

/** userIds that currently have at least one ACTIVE Membership. */
export async function listActiveMemberUserIds(): Promise<string[]> {
  const rows = await prisma.membership.findMany({
    where: { status: 'ACTIVE' },
    select: { userId: true },
    distinct: ['userId'],
  });
  return rows.map((r) => r.userId);
}

/**
 * Public school roster: ACTIVE Memberships whose userId also has a
 * marketplace Instructor listing (activation-eligible).
 *
 * Shape:
 *   Membership.findMany({ organizationId, status: ACTIVE })
 *   → Instructor.findMany({ userId in …, AND activation where, public select })
 */
export async function listSchoolListedInstructors(
  organizationId: string,
): Promise<SchoolListedInstructor[]> {
  const memberships = await prisma.membership.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { userId: true },
  });
  const userIds = memberships.map((m) => m.userId);
  if (userIds.length === 0) return [];
  return prisma.instructor.findMany({
    where: {
      userId: { in: userIds },
      AND: [buildProviderActivationWhere()],
    },
    select: PUBLIC_INSTRUCTOR_SELECT,
    orderBy: { name: 'asc' },
  });
}

export async function getOrganizationBySlug(
  slug: string,
): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { slug } });
}
