// Propose a listing-to-organization binding. It stays PENDING_REVIEW until a
// verified representative confirms it. A change never flips the active row.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  organizationId: z.string().min(1),
  evidenceRef: z.string().trim().min(1).max(500),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id: listingId } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  const [listing, organization] = await Promise.all([
    prisma.instructor.findUnique({ where: { id: listingId }, select: { id: true } }),
    prisma.organization.findUnique({
      where: { id: parsed.data.organizationId },
      select: { id: true },
    }),
  ]);
  if (!listing || !organization) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const row = await prisma.listingOrgBinding.create({
    data: {
      listingId,
      organizationId: parsed.data.organizationId,
      state: 'PENDING_REVIEW',
      evidenceRef: parsed.data.evidenceRef,
      activeListingKey: null,
    },
  });
  return NextResponse.json({ id: row.id, state: row.state });
}
