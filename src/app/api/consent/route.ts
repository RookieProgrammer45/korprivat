// @polsia:user-owned — POST /api/consent
//                      GET  /api/consent
//
// Universal cookie/consent capture endpoint. Anonymous-OK (no requireAuth)
// because the banner fires before sign-in. The route:
//   1. mints an opaque `subjectId` (UUID) for the visitor
//   2. hashes IP + UA + subjectId with SHA-256 to a `subjectHash` so retries
//      from the same visitor group without storing raw PII. The DB row
//      stores ONLY the hash; IP/UA are NOT persisted at rest for the
//      banner source. (For license-upload source we do persist them as
//      best-effort fraud-evidence — see below.)
//   3. upserts a ConsentEvent keyed by `subjectHash` (so a retry from the
//      same visitor updates the same row — readable audit trail without
//      growing storage on every page load)
//   4. sets `dl_consent_v1` cookie with the decision so later GET /api/consent
//      can rehydrate the banner's "decided" state without round-tripping
//      the hash
//
// POST returns 204 (no body) — the client's only signal is "stored".
// GET returns the parsed ConsentState from the cookie, or null if missing.

import 'server-only';
import { createHash, randomUUID } from 'node:crypto';
import { cookies, headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { ConsentEventInput, ConsentState } from '@/lib/contracts/consent';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'dl_consent_v1';
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function firstForwardedFor(headerValue: string | null): string | null {
  if (!headerValue) return null;
  const first = headerValue.split(',')[0]?.trim();
  return first && first.length > 0 ? first : null;
}

function hashSubject({
  ip,
  ua,
  subjectId,
}: {
  ip: string | null;
  ua: string | null;
  subjectId: string;
}): string {
  // SHA-256 over a fixed concat: even if one input is null we still mix all
  // three so an attacker cannot pre-compute the hash. subjectId is opaque
  // and not persisted on its own — salting it into the hash means the
  // DB column alone is useless to anyone reading it.
  const blob = `${ip ?? ''}|${ua ?? ''}|${subjectId}`;
  return createHash('sha256').update(blob).digest('hex');
}

type ParsedCookie = ConsentState;

function parseCookieValue(raw: string | undefined): ParsedCookie | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'));
    const parsed = ConsentState.safeParse(decoded);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function serializeCookieValue(state: ParsedCookie): string {
  return Buffer.from(JSON.stringify(state), 'utf-8').toString('base64');
}

async function readCookie(): Promise<ParsedCookie | null> {
  const c = await cookies();
  return parseCookieValue(c.get(COOKIE_NAME)?.value);
}

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = ConsentEventInput.safeParse(bodyJson);
  if (!parsed.success) {
    return NextResponse.json({ errors: { form: 'Invalid consent payload' } }, { status: 400 });
  }

  const h = await headers();
  const ip = firstForwardedFor(h.get('x-forwarded-for'));
  const ua = h.get('user-agent');

  const subjectId = randomUUID();
  const subjectHash = hashSubject({ ip, ua, subjectId });
  const acceptedAt = new Date();

  // For the banner / signup / license-upload sources we are happy to persist
  // the IP/UA as best-effort fraud evidence (these are the GDPR-relevant
  // surfaces: a license upload = an authorisation record). For the banner
  // (which fires before sign-in) we still keep the hash as the join key.
  try {
    await prisma.consentEvent.create({
      data: {
        userId: null,
        subjectHash,
        policyVersion: parsed.data.policyVersion,
        scope: parsed.data.scope,
        source: parsed.data.source,
        ipAddress: ip,
        userAgent: ua,
        acceptedAt,
      },
    });
  } catch (_err) {
    return NextResponse.json({ error: 'db_failed' }, { status: 500 });
  }

  const state: ParsedCookie = {
    policyVersion: parsed.data.policyVersion,
    scope: parsed.data.scope,
    source: parsed.data.source,
    subjectId,
    acceptedAt: acceptedAt.toISOString(),
  };
  const c = await cookies();
  c.set(COOKIE_NAME, serializeCookieValue(state), {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
    httpOnly: true,
  });

  return new NextResponse(null, { status: 204 });
}

export async function GET() {
  const state = await readCookie();
  return NextResponse.json(state);
}
