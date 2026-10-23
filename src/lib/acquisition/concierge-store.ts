import {
  type ConciergeProvenance,
  conciergeApprovalDecision,
  conciergePublishDecision,
  conciergeStoreDecision,
  isConciergeOnboardingOn,
} from '@/lib/acquisition/concierge-policy';
import { prisma } from '@/lib/db';

type DraftRow = {
  id: string;
  listingId: string;
  source: string;
  provenance: unknown;
  payload: unknown;
  state: string;
  approvedAt: Date | null;
  publishedAt: Date | null;
};

function db() {
  return prisma as unknown as {
    conciergeDraft?: {
      create: (args: unknown) => Promise<DraftRow>;
      findFirst: (args: unknown) => Promise<DraftRow | null>;
      findMany: (args: unknown) => Promise<DraftRow[]>;
      update: (args: unknown) => Promise<DraftRow>;
    };
    listingRepresentativeAuthority?: {
      findUnique: (
        args: unknown,
      ) => Promise<{ verifiedAt: Date | null; evidenceRef: string | null } | null>;
    };
  };
}

async function representativeVerified(listingId: string, userId: string): Promise<boolean> {
  const table = db().listingRepresentativeAuthority;
  if (!table) return false;
  const row = await table.findUnique({
    where: { listingId_userId: { listingId, userId } },
  });
  return Boolean(row?.verifiedAt && row.evidenceRef);
}

function publicDraft(row: DraftRow) {
  return {
    id: row.id,
    listingId: row.listingId,
    source: row.source,
    provenance: row.provenance,
    payload: row.payload,
    state: row.state,
    approved: Boolean(row.approvedAt),
    published: Boolean(row.publishedAt),
    policyApproved: false,
    verificationManufactured: false,
    authorizationEventsCreated: 0,
    scopesGranted: [] as [],
    bookingSurfaces: false,
  };
}

export async function storeConciergeDraft(input: {
  listingId: string;
  source: string;
  provenance: ConciergeProvenance;
  payload: Record<string, unknown>;
}) {
  const decision = conciergeStoreDecision(input);
  if (!decision.allowed) return { status: 403, body: { error: { code: decision.code } } };
  const table = db().conciergeDraft;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const row = await table.create({
    data: {
      listingId: input.listingId,
      source: input.source,
      provenance: input.provenance,
      payload: input.payload,
      state: 'DRAFT',
    },
  });
  return { status: 201, body: publicDraft(row) };
}

export async function listConciergeDrafts(listingId?: string) {
  const table = db().conciergeDraft;
  if (!table) return [];
  return table.findMany({
    where: listingId ? { listingId } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

export async function listSchoolConciergeDrafts(listingId: string, userId: string) {
  if (!(await representativeVerified(listingId, userId))) return null;
  const rows = await listConciergeDrafts(listingId);
  return rows.map(publicDraft);
}

export async function approveConciergeDraft(input: {
  listingId: string;
  draftId: string;
  userId: string;
}) {
  const verified = await representativeVerified(input.listingId, input.userId);
  const decision = conciergeApprovalDecision({ representativeVerified: verified });
  if (!decision.allowed) return { status: 403, body: { error: { code: decision.code } } };
  const table = db().conciergeDraft;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const existing = await table.findFirst({
    where: { id: input.draftId, listingId: input.listingId },
  });
  if (!existing) return { status: 404, body: { error: { code: 'not_found' } } };
  const row = await table.update({
    where: { id: existing.id },
    data: {
      state: 'SCHOOL_APPROVED',
      approvedAt: new Date(),
      approvedByUserId: input.userId,
    },
  });
  return { status: 200, body: publicDraft(row) };
}

export async function correctConciergeDraft(input: {
  listingId: string;
  draftId: string;
  userId: string;
  payload: Record<string, unknown>;
}) {
  if (!(await representativeVerified(input.listingId, input.userId))) {
    return { status: 403, body: { error: { code: 'not_representative' } } };
  }
  const table = db().conciergeDraft;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const existing = await table.findFirst({
    where: { id: input.draftId, listingId: input.listingId },
  });
  if (!existing) return { status: 404, body: { error: { code: 'not_found' } } };
  const row = await table.update({
    where: { id: existing.id },
    data: {
      payload: input.payload,
      state: 'SCHOOL_CORRECTED',
      approvedAt: null,
      approvedByUserId: null,
      publishedAt: null,
    },
  });
  return { status: 200, body: publicDraft(row) };
}

export async function publishConciergeDraft(input: {
  listingId: string;
  draftId: string;
  userId: string;
}) {
  if (!(await representativeVerified(input.listingId, input.userId))) {
    return { status: 403, body: { error: { code: 'not_representative' } } };
  }
  const table = db().conciergeDraft;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const existing = await table.findFirst({
    where: { id: input.draftId, listingId: input.listingId },
  });
  if (!existing) return { status: 404, body: { error: { code: 'not_found' } } };
  const decision = conciergePublishDecision({ schoolApproved: Boolean(existing.approvedAt) });
  if (!decision.allowed) {
    return { status: 403, body: { error: { code: decision.code }, ...decision } };
  }
  const row = await table.update({
    where: { id: existing.id },
    data: { state: 'PUBLISHED', publishedAt: new Date() },
  });
  return { status: 200, body: publicDraft(row) };
}

export async function conciergePanelForUser(userId: string) {
  if (!isConciergeOnboardingOn()) return null;
  const listings = (
    prisma as unknown as {
      instructor?: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
    }
  ).instructor;
  if (!listings) return null;
  const listing = await listings.findFirst({
    where: { userId, providerRole: 'SCHOOL' },
    select: { id: true },
  });
  if (!listing) return null;
  return listSchoolConciergeDrafts(listing.id, userId);
}
