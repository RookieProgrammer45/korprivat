import type { Membership, Organization, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/db';

export class OrgAlreadyExistsError extends Error {
  readonly code = 'ORG_EXISTS' as const;
  constructor() {
    super('Organization already exists');
    this.name = 'OrgAlreadyExistsError';
  }
}

/** Canonical Swedish org number: digits only (e.g. 5561234567). */
export function normalizeOrganizationNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^SE/i, '')
    .replace(/[\s-]/g, '');
}

function slugifyName(name: string): string {
  const base = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base.length > 0 ? base : 'skola';
}

async function uniqueSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = slugifyName(name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = await tx.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createOrganization(input: {
  name: string;
  organizationNumber: string;
  city?: string;
  address?: string;
  postcode?: string;
  ownerUserId: string;
  ownerEmail: string;
}): Promise<{ organization: Organization; membership: Membership }> {
  void input.ownerEmail; // reserved for audit / invite copy; not stored on Membership today
  const organizationNumber = normalizeOrganizationNumber(input.organizationNumber);
  const name = input.name.trim();

  try {
    return await prisma.$transaction(async (tx) => {
      const slug = await uniqueSlug(tx, name);
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          organizationNumber,
          city: input.city?.trim() || null,
          address: input.address?.trim() || null,
          postcode: input.postcode?.trim() || null,
          country: 'SE',
          verificationState: 'DRAFT',
        },
      });
      const membership = await tx.membership.create({
        data: {
          userId: input.ownerUserId,
          organizationId: organization.id,
          role: 'OWNER',
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      });
      return { organization, membership };
    });
  } catch (err) {
    if (
      err instanceof PrismaNamespace.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      const target = err.meta?.target;
      const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
      if (fields.some((f) => f.includes('organizationNumber'))) {
        throw new OrgAlreadyExistsError();
      }
    }
    throw err;
  }
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  void id;
  throw new Error('not implemented');
}

export async function listMembershipsForUser(
  userId: string,
  opts?: { onlyActive?: boolean },
): Promise<(Membership & { organization: Organization })[]> {
  const onlyActive = opts?.onlyActive ?? true;
  return prisma.membership.findMany({
    where: {
      userId,
      ...(onlyActive ? { status: 'ACTIVE' } : {}),
    },
    include: { organization: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function inviteMember(
  orgId: string,
  userId: string,
  role: 'OWNER' | 'STAFF',
  invitedBy: string,
): Promise<Membership> {
  void orgId;
  void userId;
  void role;
  void invitedBy;
  throw new Error('not implemented');
}

export async function acceptInvite(membershipId: string, userId: string): Promise<Membership> {
  void membershipId;
  void userId;
  throw new Error('not implemented');
}

export async function revokeMembership(membershipId: string, actorId: string): Promise<Membership> {
  void membershipId;
  void actorId;
  throw new Error('not implemented');
}
