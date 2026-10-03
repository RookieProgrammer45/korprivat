// POST /api/verification/handledare/approve — token approval (no session required).

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { approveHandledareInvite } from '@/lib/verification/handledare-enrollment';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(16).max(200),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const result = await approveHandledareInvite(parsed.data.token);
  if (!result.ok) {
    const status = result.reason === 'not_found' ? 404 : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }
  return NextResponse.json({ ok: true });
}
