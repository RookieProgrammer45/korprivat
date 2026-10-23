import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { CERTIFIED_CAPABILITIES } from '@/lib/certification/capability-policy';
import { enableCapability } from '@/lib/certification/capability-store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  capability: z.enum(CERTIFIED_CAPABILITIES),
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
  const result = await enableCapability({
    certificationId: id,
    capability: parsed.data.capability,
  });
  return NextResponse.json(result.body, { status: result.status });
}
