import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isClaimFunnelOn } from '@/lib/acquisition/claim-policy';
import { submitProspectClaim } from '@/lib/acquisition/claim-store';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  identityEvidenceRef: z.string().trim().min(1).max(200),
  mandateEvidenceRef: z.string().trim().min(1).max(200),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isClaimFunnelOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: { code: 'unauthorized' } }, { status: 401 });
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
  const result = await submitProspectClaim({
    prospectId: id,
    claimantUserId: userId,
    ...parsed.data,
  });
  return NextResponse.json(result.body, { status: result.status });
}
