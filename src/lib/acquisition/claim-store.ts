import {
  claimScopeDecision,
  importedPolicyDraft,
  importSourceDecision,
  publicProspectDecision,
  type TeachingCategory,
} from '@/lib/acquisition/claim-policy';
import { prisma } from '@/lib/db';
import type { LegacyCancellationTier } from '@/lib/scheduling/booking-policy';

type ProspectRow = {
  id: string;
  legalName: string;
  city: string;
  categories: string[];
  visibility: string;
  claimState: string;
  eligibility: string;
  dataQuality: string;
  policyDraft: unknown;
};

type ClaimRow = {
  id: string;
  identityStatus: string;
  mandateStatus: string;
  representativeStatus: string;
};

function prospects() {
  return prisma as unknown as {
    listingProspect?: {
      create: (args: unknown) => Promise<ProspectRow>;
      findUnique: (args: unknown) => Promise<ProspectRow | null>;
      update: (args: unknown) => Promise<ProspectRow>;
      findMany: (args: unknown) => Promise<ProspectRow[]>;
    };
    prospectClaim?: {
      create: (args: unknown) => Promise<ClaimRow>;
      findFirst: (args: unknown) => Promise<ClaimRow | null>;
      update: (args: unknown) => Promise<ClaimRow>;
    };
  };
}

export async function importSyntheticProspect(input: {
  legalName: string;
  orgNumber: string;
  country: string;
  city: string;
  categories: TeachingCategory[];
  source: string;
  policyTier: LegacyCancellationTier | null;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const source = importSourceDecision(input.source);
  if (!source.allowed) return { status: 403, body: { error: { code: source.code } } };
  const table = prospects().listingProspect;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const row = await table.create({
    data: {
      legalName: input.legalName,
      orgNumber: input.orgNumber,
      country: input.country.toUpperCase(),
      city: input.city,
      categories: input.categories,
      source: 'SYNTHETIC_FIXTURE',
      eligibility: 'PENDING',
      dataQuality: 'PENDING',
      visibility: 'PRIVATE',
      claimState: 'UNCLAIMED',
      policyDraft: importedPolicyDraft(input.policyTier),
    },
  });
  return {
    status: 201,
    body: { id: row.id, visibility: 'PRIVATE', scopesGranted: [] },
  };
}

export async function readPublicProspect(
  id: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const table = prospects().listingProspect;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const row = await table.findUnique({ where: { id } });
  if (!row) return { status: 404, body: { error: { code: 'not_found' } } };
  const decision = publicProspectDecision(row);
  if (!decision.visible || row.visibility !== 'PUBLIC') {
    return { status: 404, body: { error: { code: 'not_found' } } };
  }
  return {
    status: 200,
    body: {
      id: row.id,
      legalName: row.legalName,
      city: row.city,
      categories: row.categories,
      claimState: row.claimState,
      bookingSurfaces: false,
    },
  };
}

export async function submitProspectClaim(input: {
  prospectId: string;
  claimantUserId: string;
  identityEvidenceRef: string;
  mandateEvidenceRef: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const tables = prospects();
  if (!tables.listingProspect || !tables.prospectClaim) {
    return { status: 503, body: { error: { code: 'not_available' } } };
  }
  const prospect = await tables.listingProspect.findUnique({ where: { id: input.prospectId } });
  if (!prospect) return { status: 404, body: { error: { code: 'not_found' } } };
  await tables.prospectClaim.create({
    data: {
      prospectId: input.prospectId,
      claimantUserId: input.claimantUserId,
      identityEvidenceRef: input.identityEvidenceRef,
      mandateEvidenceRef: input.mandateEvidenceRef,
      identityStatus: 'PENDING_REVIEW',
      mandateStatus: 'PENDING_REVIEW',
      representativeStatus: 'PENDING_REVIEW',
      scopesGranted: [],
    },
  });
  await tables.listingProspect.update({
    where: { id: input.prospectId },
    data: { claimState: 'SUBMITTED' },
  });
  const decision = claimScopeDecision({
    identityStatus: 'PENDING_REVIEW',
    mandateStatus: 'PENDING_REVIEW',
    representativeStatus: 'PENDING_REVIEW',
  });
  return { status: 202, body: decision };
}

export async function reviewProspectChecks(input: {
  prospectId: string;
  eligibility: 'ELIGIBLE' | 'REJECTED';
  dataQuality: 'PASS' | 'FAIL';
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const table = prospects().listingProspect;
  if (!table) return { status: 503, body: { error: { code: 'not_available' } } };
  const existing = await table.findUnique({ where: { id: input.prospectId } });
  if (!existing) return { status: 404, body: { error: { code: 'not_found' } } };
  const decision = publicProspectDecision({
    eligibility: input.eligibility,
    dataQuality: input.dataQuality,
    claimState: existing.claimState,
  });
  const row = await table.update({
    where: { id: input.prospectId },
    data: {
      eligibility: input.eligibility,
      dataQuality: input.dataQuality,
      visibility: decision.visible ? 'PUBLIC' : 'PRIVATE',
    },
  });
  return {
    status: 200,
    body: { id: row.id, visibility: decision.visible ? 'PUBLIC' : 'PRIVATE', scopesGranted: [] },
  };
}

export async function reviewProspectClaim(input: {
  prospectId: string;
  identityStatus: 'VERIFIED' | 'REJECTED';
  mandateStatus: 'VERIFIED' | 'REJECTED';
  representativeStatus: 'VERIFIED' | 'REJECTED';
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const claims = prospects().prospectClaim;
  if (!claims) return { status: 503, body: { error: { code: 'not_available' } } };
  const claim = await claims.findFirst({
    where: { prospectId: input.prospectId },
    orderBy: { createdAt: 'desc' },
  });
  if (!claim) return { status: 404, body: { error: { code: 'not_found' } } };
  await claims.update({
    where: { id: claim.id },
    data: {
      identityStatus: input.identityStatus,
      mandateStatus: input.mandateStatus,
      representativeStatus: input.representativeStatus,
      scopesGranted: [],
    },
  });
  return { status: 200, body: claimScopeDecision(input) };
}

export async function listProspectsForAdmin(): Promise<ProspectRow[]> {
  const table = prospects().listingProspect;
  if (!table) return [];
  return table.findMany({ orderBy: { createdAt: 'desc' } });
}
