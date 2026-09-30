import { randomBytes } from 'node:crypto';
import type { Membership, MembershipInvite, Organization, Prisma } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import { prisma } from '@/lib/db';

export class OrgAlreadyExistsError extends Error {
  readonly code = 'ORG_EXISTS' as const;
  constructor() {
    super('Organization already exists');
    this.name = 'OrgAlreadyExistsError';
  }
}

export class OrgMemberAlreadyExistsError extends Error {
  readonly code = 'ORG_MEMBER_EXISTS' as const;
  constructor() {
    super('Member or invite already exists');
    this.name = 'OrgMemberAlreadyExistsError';
  }
}

export class OrgForbiddenError extends Error {
  readonly code = 'ORG_FORBIDDEN' as const;
  constructor() {
    super('Not authorized for this organization');
    this.name = 'OrgForbiddenError';
  }
}

export class OrgNotFoundError extends Error {
  readonly code = 'ORG_NOT_FOUND' as const;
  constructor() {
    super('Organization not found');
    this.name = 'OrgNotFoundError';
  }
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Canonical Swedish org number: digits only (e.g. 5561234567). */
export function normalizeOrganizationNumber(raw: string): string {
  return raw
    .trim()
    .replace(/^SE/i, '')
    .replace(/[\s-]/g, '');
}

export function slugify(baseName: string): string {
  const base = baseName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return base.length > 0 ? base : 'skola';
}

function isP2002OnField(err: unknown, field: string): boolean {
  if (!(err instanceof PrismaNamespace.PrismaClientKnownRequestError) || err.code !== 'P2002') {
    return false;
  }
  const target = err.meta?.target;
  const fields = Array.isArray(target) ? target.map(String) : [String(target ?? '')];
  return fields.some((f) => f.includes(field));
}

export async function generateUniqueSlug(
  baseName: string,
  excludeId?: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const base = slugify(baseName);
  let candidate = base;
  let suffix = 1;
  while (suffix <= 50) {
    const exists = await client.organization.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!exists || exists.id === excludeId) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return `${base}-${randomBytes(3).toString('hex')}`;
}

async function requireOwnerMembership(orgId: string, actorId: string): Promise<Membership> {
  const membership = await prisma.membership.findFirst({
    where: {
      organizationId: orgId,
      userId: actorId,
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });
  if (!membership) throw new OrgForbiddenError();
  return membership;
}

/** ACTIVE OWNER gate for org-scoped API routes (Connect, invites, settings). */
export async function assertActiveOwner(orgId: string, actorId: string): Promise<Membership> {
  return requireOwnerMembership(orgId, actorId);
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
  const organizationNumber = normalizeOrganizationNumber(input.organizationNumber);
  const name = input.name.trim();
  const contactEmail = input.ownerEmail.trim().toLowerCase();

  const run = async (slug: string) =>
    prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: {
          name,
          slug,
          organizationNumber,
          city: input.city?.trim() || null,
          address: input.address?.trim() || null,
          postcode: input.postcode?.trim() || null,
          contactEmail,
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

  try {
    const slug = await generateUniqueSlug(name);
    return await run(slug);
  } catch (err) {
    if (isP2002OnField(err, 'organizationNumber')) {
      throw new OrgAlreadyExistsError();
    }
    if (isP2002OnField(err, 'slug')) {
      const slug = await generateUniqueSlug(name);
      try {
        return await run(slug);
      } catch (retryErr) {
        if (isP2002OnField(retryErr, 'organizationNumber')) {
          throw new OrgAlreadyExistsError();
        }
        throw retryErr;
      }
    }
    throw err;
  }
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  return prisma.organization.findUnique({ where: { id } });
}

export async function updateOrganization(
  orgId: string,
  actorId: string,
  data: {
    name?: string;
    address?: string | null;
    postcode?: string | null;
    city?: string | null;
    contactEmail?: string | null;
    contactPhone?: string | null;
  },
): Promise<Organization> {
  await requireOwnerMembership(orgId, actorId);
  const existing = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!existing) throw new OrgNotFoundError();

  const name = data.name?.trim();
  let slug = existing.slug;
  if (name && name !== existing.name) {
    slug = await generateUniqueSlug(name, orgId);
  }

  const patch: Prisma.OrganizationUpdateInput = {
    ...(name ? { name, slug } : {}),
    ...(data.address !== undefined ? { address: data.address?.trim() || null } : {}),
    ...(data.postcode !== undefined ? { postcode: data.postcode?.trim() || null } : {}),
    ...(data.city !== undefined ? { city: data.city?.trim() || null } : {}),
    ...(data.contactEmail !== undefined
      ? { contactEmail: data.contactEmail?.trim().toLowerCase() || null }
      : {}),
    ...(data.contactPhone !== undefined
      ? { contactPhone: data.contactPhone?.trim() || null }
      : {}),
  };

  try {
    return await prisma.organization.update({ where: { id: orgId }, data: patch });
  } catch (err) {
    if (isP2002OnField(err, 'slug') && name) {
      const retrySlug = await generateUniqueSlug(name, orgId);
      return prisma.organization.update({
        where: { id: orgId },
        data: { ...patch, slug: retrySlug },
      });
    }
    throw err;
  }
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

export async function listOrgMembers(orgId: string): Promise<
  Array<
    Membership & {
      user: { id: string; name: string; email: string };
    }
  >
> {
  return prisma.membership.findMany({
    where: { organizationId: orgId, status: { in: ['ACTIVE', 'REVOKED'] } },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
}

export async function listOrgInvites(orgId: string): Promise<MembershipInvite[]> {
  return prisma.membershipInvite.findMany({
    where: { organizationId: orgId, acceptedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function inviteMember(
  orgId: string,
  email: string,
  role: 'STAFF',
  invitedBy: string,
): Promise<{ invite: MembershipInvite; inviteToken: string }> {
  await requireOwnerMembership(orgId, invitedBy);
  const normalized = email.trim().toLowerCase();
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) throw new OrgNotFoundError();

  const existingUser = await prisma.user.findUnique({
    where: { email: normalized },
    select: { id: true },
  });
  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: { userId: existingUser.id, organizationId: orgId },
      },
    });
    if (existingMembership && existingMembership.status !== 'REVOKED') {
      throw new OrgMemberAlreadyExistsError();
    }
  }

  const pendingInvite = await prisma.membershipInvite.findFirst({
    where: {
      organizationId: orgId,
      email: normalized,
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (pendingInvite) throw new OrgMemberAlreadyExistsError();

  const inviteToken = randomBytes(32).toString('hex');
  const invite = await prisma.membershipInvite.create({
    data: {
      organizationId: orgId,
      email: normalized,
      role,
      token: inviteToken,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      invitedBy,
    },
  });
  return { invite, inviteToken };
}

export async function getInviteByToken(token: string): Promise<
  | (MembershipInvite & { organization: Organization })
  | null
> {
  return prisma.membershipInvite.findUnique({
    where: { token },
    include: { organization: true },
  });
}

export async function acceptInviteByToken(
  token: string,
  userId: string,
  userEmail: string,
): Promise<{ organizationId: string }> {
  const invite = await prisma.membershipInvite.findUnique({ where: { token } });
  if (!invite) throw new OrgNotFoundError();
  if (invite.acceptedAt) {
    return { organizationId: invite.organizationId };
  }
  if (invite.expiresAt.getTime() < Date.now()) {
    throw new OrgForbiddenError();
  }
  if (invite.email !== userEmail.trim().toLowerCase()) {
    throw new OrgForbiddenError();
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.membership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId: invite.organizationId },
      },
    });
    if (existing) {
      await tx.membership.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          role: invite.role,
          acceptedAt: existing.acceptedAt ?? new Date(),
          revokedAt: null,
        },
      });
    } else {
      await tx.membership.create({
        data: {
          userId,
          organizationId: invite.organizationId,
          role: invite.role,
          status: 'ACTIVE',
          invitedBy: invite.invitedBy,
          invitedAt: invite.createdAt,
          acceptedAt: new Date(),
        },
      });
    }
    await tx.membershipInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });
  });

  return { organizationId: invite.organizationId };
}

export async function revokeMembership(
  membershipId: string,
  actorId: string,
): Promise<Membership> {
  const membership = await prisma.membership.findUnique({ where: { id: membershipId } });
  if (!membership) throw new OrgNotFoundError();
  await requireOwnerMembership(membership.organizationId, actorId);
  if (membership.role === 'OWNER') throw new OrgForbiddenError();
  return prisma.membership.update({
    where: { id: membershipId },
    data: { status: 'REVOKED', revokedAt: new Date() },
  });
}

export async function resendInvite(
  inviteId: string,
  actorId: string,
): Promise<{ invite: MembershipInvite; inviteToken: string }> {
  const invite = await prisma.membershipInvite.findUnique({ where: { id: inviteId } });
  if (!invite || invite.acceptedAt) throw new OrgNotFoundError();
  await requireOwnerMembership(invite.organizationId, actorId);
  const inviteToken = randomBytes(32).toString('hex');
  const updated = await prisma.membershipInvite.update({
    where: { id: inviteId },
    data: {
      token: inviteToken,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });
  return { invite: updated, inviteToken };
}

export async function cancelInvite(inviteId: string, actorId: string): Promise<void> {
  const invite = await prisma.membershipInvite.findUnique({ where: { id: inviteId } });
  if (!invite) throw new OrgNotFoundError();
  await requireOwnerMembership(invite.organizationId, actorId);
  await prisma.membershipInvite.delete({ where: { id: inviteId } });
}

/** @deprecated Prefer inviteMember(email). Kept for stub compatibility. */
export async function acceptInvite(membershipId: string, userId: string): Promise<Membership> {
  void membershipId;
  void userId;
  throw new Error('not implemented — use acceptInviteByToken');
}
