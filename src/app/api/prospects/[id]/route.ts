import 'server-only';
import { NextResponse } from 'next/server';
import { isClaimFunnelOn } from '@/lib/acquisition/claim-policy';
import { readPublicProspect } from '@/lib/acquisition/claim-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isClaimFunnelOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  const { id } = await ctx.params;
  const result = await readPublicProspect(id);
  return NextResponse.json(result.body, { status: result.status });
}
