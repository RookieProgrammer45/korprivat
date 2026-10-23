import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isClaimFunnelOn, TEACHING_CATEGORIES } from '@/lib/acquisition/claim-policy';
import { importSyntheticProspect } from '@/lib/acquisition/claim-store';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  orgNumber: z.string().trim().min(1).max(40),
  country: z.string().trim().length(2),
  city: z.string().trim().min(1).max(80),
  categories: z.array(z.enum(TEACHING_CATEGORIES)).min(1),
  source: z.string().trim().min(1),
  policyTier: z.enum(['flexible', 'moderate', 'strict']).nullable().optional(),
});

export async function POST(req: Request) {
  if (!isClaimFunnelOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  const result = await importSyntheticProspect({
    ...parsed.data,
    policyTier: parsed.data.policyTier ?? null,
  });
  return NextResponse.json(result.body, { status: result.status });
}
