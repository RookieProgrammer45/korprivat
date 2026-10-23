// Records verified representative authority. This is not a scope grant.
// An authenticated listing owner is not a representative until this row exists.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  userId: z.string().min(1),
  evidenceRef: z.string().trim().min(1).max(500),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  const { id: listingId } = await ctx.params;
  const instructor = await prisma.instructor.findUnique({
    where: { id: listingId },
    select: { id: true },
  });
  if (!instructor) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const row = await prisma.listingRepresentativeAuthority.upsert({
    where: { listingId_userId: { listingId, userId: parsed.data.userId } },
    create: {
      listingId,
      userId: parsed.data.userId,
      evidenceRef: parsed.data.evidenceRef,
      verifiedAt: new Date(),
    },
    update: { evidenceRef: parsed.data.evidenceRef, verifiedAt: new Date() },
  });
  return NextResponse.json({
    id: row.id,
    listingId: row.listingId,
    userId: row.userId,
    verifiedAt: row.verifiedAt.toISOString(),
    evidenceRef: row.evidenceRef,
  });
}
