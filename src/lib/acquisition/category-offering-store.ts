import {
  categoryBookingSnapshot,
  isCategoryOfferingsOn,
  offeringPolicySelection,
  offeringPublicationDecision,
  type TeachingPermissionFact,
} from '@/lib/acquisition/category-offering-policy';
import { prisma } from '@/lib/db';

type PermissionRow = TeachingPermissionFact & { id: string; listingId: string };

function db() {
  return prisma as unknown as {
    teachingPermission?: {
      findMany: (args: unknown) => Promise<PermissionRow[]>;
      create: (args: unknown) => Promise<{ id: string }>;
    };
    membership?: {
      findFirst: (args: unknown) => Promise<{
        organization?: { organizationNumber?: string | null };
      } | null>;
    };
    cancellationPolicy?: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        listingId: string;
        version: number;
        approvedAt: Date | null;
        state: string;
      } | null>;
    };
    categoryOffering?: {
      create: (args: unknown) => Promise<{ id: string }>;
      findFirst: (args: unknown) => Promise<{
        offeringId: string;
        listingId: string;
        category: string;
        policyId: string | null;
        policyVersion: number | null;
      } | null>;
      findMany: (args: unknown) => Promise<
        Array<{
          id: string;
          offeringId: string;
          listingId: string;
          category: string;
          policyId: string | null;
          policyVersion: number | null;
        }>
      >;
    };
  };
}

export async function recordTeachingPermission(input: {
  listingId: string;
  category: string;
  legalEntityRef: string;
  locationRef: string;
  evidenceRef: string;
}) {
  const table = db().teachingPermission;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const row = await table.create({
    data: { ...input, status: 'CURRENT' },
  });
  return { status: 201, body: { id: row.id, scopesGranted: [] } };
}

export async function gateCategoryOffering(input: {
  listingId: string;
  userId: string;
  city: string;
  offeringCategory: string;
  cancellationPolicyId?: string;
}) {
  const client = db();
  const permissions = client.teachingPermission
    ? await client.teachingPermission.findMany({
        where: { listingId: input.listingId, status: 'CURRENT' },
      })
    : [];
  const membership = client.membership
    ? await client.membership.findFirst({
        where: { userId: input.userId, status: 'ACTIVE' },
        include: { organization: { select: { organizationNumber: true } } },
      })
    : null;
  const publication = offeringPublicationDecision({
    enforced: true,
    offeringCategory: input.offeringCategory,
    permissions,
    listingLegalEntity: membership?.organization?.organizationNumber ?? '',
    listingLocation: input.city,
  });
  if (!publication.allowed) return { allowed: false as const, code: publication.code };
  if (!input.cancellationPolicyId) {
    return {
      allowed: true as const,
      category: input.offeringCategory,
      snapshot: null as { policyId: string; version: number } | null,
    };
  }
  const policy = client.cancellationPolicy
    ? await client.cancellationPolicy.findUnique({ where: { id: input.cancellationPolicyId } })
    : null;
  const selected = offeringPolicySelection({
    policy: policy
      ? {
          id: policy.id,
          listingId: policy.listingId,
          version: policy.version,
          approvedAt: policy.approvedAt ? policy.approvedAt.toISOString() : null,
          state: policy.state,
        }
      : null,
    listingId: input.listingId,
  });
  if (!selected.ok) return { allowed: false as const, code: selected.code };
  return { allowed: true as const, category: input.offeringCategory, snapshot: selected.snapshot };
}

export async function saveCategoryOffering(input: {
  offeringId: string;
  listingId: string;
  category: string;
  snapshot: { policyId: string; version: number } | null;
}) {
  const table = db().categoryOffering;
  if (!table) return;
  await table.create({
    data: {
      offeringId: input.offeringId,
      listingId: input.listingId,
      category: input.category,
      policyId: input.snapshot?.policyId ?? null,
      policyVersion: input.snapshot?.version ?? null,
    },
  });
}

export async function categorySnapshotForBooking(offeringId: string, instructorId: string) {
  if (!isCategoryOfferingsOn()) return { ok: true as const, snapshot: null };
  const row = db().categoryOffering
    ? await db().categoryOffering?.findFirst({ where: { offeringId, listingId: instructorId } })
    : null;
  if (!row) return { ok: false as const, status: 403, code: 'category_not_permitted' };
  return {
    ok: true as const,
    snapshot: categoryBookingSnapshot({
      offeringId: row.offeringId,
      category: row.category,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
    }),
  };
}

export async function listCategoryOfferings(category: string) {
  const offerings = db().categoryOffering;
  const permissions = db().teachingPermission;
  if (!offerings || !permissions) return [];
  const rows = await offerings.findMany({ where: { category } });
  const current = await permissions.findMany({ where: { category, status: 'CURRENT' } });
  const allowedListings = new Set(
    current.map((permission) => `${permission.listingId}:${permission.category}`),
  );
  return rows
    .filter((row) => allowedListings.has(`${row.listingId}:${row.category}`))
    .map((row) => ({
      offeringId: row.offeringId,
      category: row.category,
      policyId: row.policyId,
      policyVersion: row.policyVersion,
      bookingSurfaces: false as const,
    }));
}
