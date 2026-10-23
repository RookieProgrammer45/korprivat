import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { CERTIFIED_CAPABILITIES } from '@/lib/certification/capability-policy';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  product: z.string().trim().min(1).max(80),
  version: z.string().trim().min(1).max(40),
  market: z.string().trim().min(2).max(8),
  capabilities: z.array(z.enum(CERTIFIED_CAPABILITIES)).default([]),
  milestoneEvidence: z
    .object({
      source: z.enum(['mock', 'sandbox', 'vendor_environment']).optional(),
      milestone3: z.boolean().optional(),
      milestone5: z.boolean().optional(),
      atomicReschedule: z.boolean().optional(),
    })
    .default({}),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const certifications = (
    prisma as unknown as {
      certification?: { create: (args: unknown) => Promise<{ id: string }> };
    }
  ).certification;
  if (!certifications) {
    return NextResponse.json({ error: { code: 'not_available' } }, { status: 503 });
  }
  const row = await certifications.create({
    data: {
      partnerId: id,
      product: parsed.data.product,
      version: parsed.data.version,
      market: parsed.data.market.toUpperCase(),
      capabilities: parsed.data.capabilities,
      milestoneEvidence: parsed.data.milestoneEvidence,
      prodEnabled: {},
    },
  });
  return NextResponse.json({ id: row.id, prodEnabled: {} }, { status: 201 });
}
