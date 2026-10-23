import 'server-only';
import { NextResponse } from 'next/server';
import { requirePartner } from '@/lib/connectivity/http';
import { listPartnerConnections } from '@/lib/connectivity/partner-gateway';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const gate = await requirePartner(req);
  if ('response' in gate && gate.response) return gate.response;
  if (!('auth' in gate)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Missing partner signature.', retryable: false } },
      { status: 401 },
    );
  }
  const connections = await listPartnerConnections(
    gate.auth.partnerKey,
    gate.auth.connection.environment,
  );
  return NextResponse.json({ connections });
}
