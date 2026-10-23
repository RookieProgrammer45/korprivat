import 'server-only';
import { NextResponse } from 'next/server';
import {
  enabledCapabilityNames,
  isCertificationEnforced,
} from '@/lib/certification/capability-policy';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isCertificationEnforced()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const partners = (
    prisma as unknown as {
      partner?: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            legalName: string;
            country: string;
            certifications: Array<{ prodEnabled: unknown }>;
          }>
        >;
      };
    }
  ).partner;
  const rows = partners
    ? await partners.findMany({
        where: { status: 'CERTIFIED' },
        select: {
          id: true,
          legalName: true,
          country: true,
          certifications: { select: { prodEnabled: true } },
        },
      })
    : [];
  return NextResponse.json({
    partners: rows.map((partner) => ({
      id: partner.id,
      legalName: partner.legalName,
      country: partner.country,
      prodEnabled: enabledCapabilityNames(partner.certifications[0]?.prodEnabled),
    })),
  });
}
