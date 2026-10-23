import 'server-only';
import {
  type CertifiedCapability,
  connectorInstantBookingCertified,
  enabledCapabilityNames,
  type MilestoneEvidence,
  productionCapabilityDecision,
} from '@/lib/certification/capability-policy';
import { prisma } from '@/lib/db';

export async function listingConnectorCertified(listingId: string): Promise<boolean> {
  const connections = (
    prisma as unknown as {
      schoolConnection?: {
        findFirst: (args: unknown) => Promise<{ partnerId: string | null } | null>;
      };
    }
  ).schoolConnection;
  const certifications = (
    prisma as unknown as {
      certification?: {
        findFirst: (args: unknown) => Promise<{ prodEnabled: unknown } | null>;
      };
    }
  ).certification;
  if (!connections || !certifications) return false;
  const connection = await connections.findFirst({
    where: { listingId, environment: 'production' },
    select: { partnerId: true },
  });
  if (!connection?.partnerId) return false;
  const certification = await certifications.findFirst({
    where: { partnerId: connection.partnerId },
    orderBy: { createdAt: 'desc' },
    select: { prodEnabled: true },
  });
  return connectorInstantBookingCertified(certification?.prodEnabled);
}

export async function enableCapability(input: {
  certificationId: string;
  capability: CertifiedCapability;
}): Promise<{ status: number; body: unknown }> {
  const certifications = (
    prisma as unknown as {
      certification?: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          milestoneEvidence: unknown;
          prodEnabled: unknown;
        } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    }
  ).certification;
  if (!certifications) {
    return { status: 503, body: { error: { code: 'not_available' } } };
  }
  const row = await certifications.findUnique({
    where: { id: input.certificationId },
    select: { id: true, milestoneEvidence: true, prodEnabled: true },
  });
  if (!row) return { status: 404, body: { error: { code: 'not_found' } } };
  const evidence = (row.milestoneEvidence ?? {}) as MilestoneEvidence;
  const decision = productionCapabilityDecision({ capability: input.capability, evidence });
  if (!decision.allowed) {
    return { status: 403, body: { error: { code: decision.code }, prodEnabled: row.prodEnabled } };
  }
  const current =
    row.prodEnabled && typeof row.prodEnabled === 'object' && !Array.isArray(row.prodEnabled)
      ? { ...(row.prodEnabled as Record<string, boolean>) }
      : {};
  current[input.capability] = true;
  await certifications.update({
    where: { id: row.id },
    data: { prodEnabled: current },
  });
  return { status: 200, body: { id: row.id, prodEnabled: current } };
}

export async function schoolProductionCapabilities(userId: string): Promise<string[]> {
  try {
    const db = prisma as unknown as {
      instructor?: { findFirst: (args: unknown) => Promise<{ id: string } | null> };
      schoolConnection?: {
        findFirst: (args: unknown) => Promise<{ partnerId: string | null } | null>;
      };
      certification?: { findFirst: (args: unknown) => Promise<{ prodEnabled: unknown } | null> };
    };
    const listing = db.instructor
      ? await db.instructor.findFirst({ where: { userId }, select: { id: true } })
      : null;
    if (!listing || !db.schoolConnection || !db.certification) return [];
    const connection = await db.schoolConnection.findFirst({
      where: { listingId: listing.id, environment: 'production' },
      select: { partnerId: true },
    });
    if (!connection?.partnerId) return [];
    const certification = await db.certification.findFirst({
      where: { partnerId: connection.partnerId },
      orderBy: { createdAt: 'desc' },
      select: { prodEnabled: true },
    });
    return enabledCapabilityNames(certification?.prodEnabled);
  } catch {
    return [];
  }
}

export async function listPartnersForAdmin(): Promise<
  Array<{ id: string; legalName: string; country: string; status: string }>
> {
  const partners = (
    prisma as unknown as {
      partner?: {
        findMany: (
          args: unknown,
        ) => Promise<Array<{ id: string; legalName: string; country: string; status: string }>>;
      };
    }
  ).partner;
  if (!partners) return [];
  return partners.findMany({
    orderBy: { legalName: 'asc' },
    select: { id: true, legalName: true, country: true, status: true },
  });
}
