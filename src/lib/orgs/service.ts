import type { Membership, Organization } from '@prisma/client';

export async function createOrganization(input: {
  name: string;
  slug: string;
  organizationNumber: string;
  vatNumber?: string | null;
  address?: string | null;
  postcode?: string | null;
  city?: string | null;
  country?: string;
}): Promise<Organization> {
  void input;
  throw new Error('not implemented');
}

export async function getOrganizationById(id: string): Promise<Organization | null> {
  void id;
  throw new Error('not implemented');
}

export async function listMembershipsForUser(userId: string): Promise<Membership[]> {
  void userId;
  throw new Error('not implemented');
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
