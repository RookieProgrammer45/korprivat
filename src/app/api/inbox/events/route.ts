import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isReliableProcessingOn } from '@/lib/reliability/inbox-policy';
import { receiveInboxEvent } from '@/lib/reliability/inbox-store';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  connectionId: z.string().min(1),
  providerEventId: z.string().min(1),
  eventType: z.string().min(1),
  externalRef: z.string().min(1).optional(),
  revision: z.number().int().optional(),
  occurredAt: z.string().datetime().optional(),
  payload: z.unknown().optional(),
});

export async function POST(req: Request) {
  if (!isReliableProcessingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
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
  const result = await receiveInboxEvent({
    ...parsed.data,
    occurredAt: parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : null,
  });
  return NextResponse.json(result.body, { status: result.httpStatus });
}
