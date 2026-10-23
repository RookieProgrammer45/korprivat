import { NextResponse } from 'next/server';
import { authenticatePartner, type PartnerFailure } from '@/lib/connectivity/partner-gateway';
import { isConnectivityEnabled } from '@/lib/connectivity/policy';

export function connectivityDisabled(): NextResponse | null {
  if (isConnectivityEnabled()) return null;
  return NextResponse.json(
    { error: { code: 'not_found', message: 'Not found.', retryable: false } },
    { status: 404 },
  );
}

export function partnerFailureResponse(failure: PartnerFailure): NextResponse {
  return NextResponse.json(
    { error: { code: failure.code, message: failure.message, retryable: failure.retryable } },
    {
      status: failure.status,
      headers: failure.retryAfterSeconds
        ? { 'retry-after': String(failure.retryAfterSeconds) }
        : undefined,
    },
  );
}

export async function requirePartner(req: Request, urlConnectionId?: string) {
  const disabled = connectivityDisabled();
  if (disabled) return { response: disabled };
  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? '' : await req.text();
  const auth = await authenticatePartner({
    method: req.method,
    path: new URL(req.url).pathname,
    rawBody,
    headers: req.headers,
    urlConnectionId,
  });
  if (!auth.ok) return { response: partnerFailureResponse(auth) };
  return { auth, rawBody };
}
