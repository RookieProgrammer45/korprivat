import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isClaimFunnelOn } from '@/lib/acquisition/claim-policy';
import { reviewProspectClaim } from '@/lib/acquisition/claim-store';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const statusSchema = z.enum(['VERIFIED', 'REJECTED']);
const bodySchema = z.object({
  identityStatus: statusSchema,
  mandateStatus: statusSchema,
  representativeStatus: statusSchema,
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isClaimFunnelOn())
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
  const result = await reviewProspectClaim({ prospectId: id, ...parsed.data });
  return NextResponse.json(result.body, { status: result.status });
}
