import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isReliableProcessingOn } from '@/lib/reliability/inbox-policy';
import { resolveOutboxCommand } from '@/lib/reliability/inbox-store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  kind: z.enum(['ttl_expired', 'retry_exhausted', 'authoritative', 'audited_decision']),
  rationale: z.string().max(2000).optional(),
  resolutionRef: z.string().max(500).optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isReliableProcessingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_json' } }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 400 });
  }
  const result = await resolveOutboxCommand({ id, ...parsed.data });
  return NextResponse.json(result.body, { status: result.httpStatus });
}
