import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isCategoryOfferingsOn,
  OFFERING_CATEGORIES,
} from '@/lib/acquisition/category-offering-policy';
import { recordTeachingPermission } from '@/lib/acquisition/category-offering-store';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  category: z.enum(OFFERING_CATEGORIES),
  legalEntityRef: z.string().trim().min(1).max(40),
  locationRef: z.string().trim().min(1).max(80),
  evidenceRef: z.string().trim().min(1).max(200),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isCategoryOfferingsOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
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
  if (!parsed.success)
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  const result = await recordTeachingPermission({ listingId: id, ...parsed.data });
  return NextResponse.json(result.body, { status: result.status });
}
