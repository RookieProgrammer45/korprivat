import 'server-only';
import { NextResponse } from 'next/server';
import { requirePartner } from '@/lib/connectivity/http';
import { acceptInboundEvent } from '@/lib/connectivity/partner-gateway';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const gate = await requirePartner(req, id);
  if ('response' in gate && gate.response) return gate.response;
  if (!('auth' in gate) || !gate.rawBody) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Missing partner signature.', retryable: false } },
      { status: 401 },
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(gate.rawBody);
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_body', message: 'Event payload is invalid.', retryable: false } },
      { status: 422 },
    );
  }
  const result = await acceptInboundEvent({ connectionId: gate.auth.connection.id, body });
  return NextResponse.json(result.body, {
    status: result.status,
    headers: result.retryAfterSeconds
      ? { 'retry-after': String(result.retryAfterSeconds) }
      : undefined,
  });
}
