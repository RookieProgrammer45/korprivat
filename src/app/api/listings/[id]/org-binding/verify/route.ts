// A verified representative activates one pending binding. Any previous active
// binding for the listing is revoked in the same transaction.

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({ bindingId: z.string().min(1) });

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
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

  const representative = await prisma.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId, userId: user.id } },
  });
  if (!representative) return NextResponse.json({ error: 'not_representative' }, { status: 403 });

  const pending = await prisma.listingOrgBinding.findFirst({
    where: { id: parsed.data.bindingId, listingId, state: 'PENDING_REVIEW' },
  });
  if (!pending) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  await prisma.$transaction([
    prisma.listingOrgBinding.updateMany({
      where: { listingId, state: 'ACTIVE' },
      data: { state: 'REVOKED', activeListingKey: null },
    }),
    prisma.listingOrgBinding.update({
      where: { id: pending.id },
      data: {
        state: 'ACTIVE',
        verifiedAt: new Date(),
        verifiedByUserId: user.id,
        activeListingKey: listingId,
      },
    }),
  ]);
  return NextResponse.json({ id: pending.id, state: 'ACTIVE' });
}
