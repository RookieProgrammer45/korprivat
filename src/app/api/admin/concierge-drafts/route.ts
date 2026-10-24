import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TEACHING_CATEGORIES } from '@/lib/acquisition/claim-policy';
import { isConciergeOnboardingOn } from '@/lib/acquisition/concierge-policy';
import { listConciergeDrafts, storeConciergeDraft } from '@/lib/acquisition/concierge-store';
import { OUTREACH_FROM, OUTREACH_SIGNATURE } from '@/lib/acquisition/outreach-sequence-policy';
import { auth } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const listingPayloadSchema = z.object({
  legalName: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(80),
  categories: z.array(z.enum(TEACHING_CATEGORIES)).min(1),
  policyTier: z.enum(['flexible', 'moderate', 'strict']).nullable().optional(),
});

const outreachPayloadSchema = z.object({
  kind: z.literal('OUTREACH_SEQUENCE'),
  from: z.literal(OUTREACH_FROM),
  signature: z.literal(OUTREACH_SIGNATURE),
  sent: z.literal(false),
  sendBlocked: z.literal('channel_not_authorized'),
  schoolName: z.string().trim().min(1).max(200),
  listingId: z.string().nullable().optional(),
  listingUrl: z.string().nullable().optional(),
  claimPage: z.literal('missing'),
  scopesPreselected: z.array(z.never()).max(0),
  authorizationEventsCreated: z.literal(0),
  policyApproved: z.literal(false),
  verificationManufactured: z.literal(false),
  bookingSurfaces: z.literal(false),
  cadence: z
    .array(
      z.object({
        day: z.union([z.literal(0), z.literal(4), z.literal(10)]),
        subject: z.string().trim().min(1),
        body: z.string().trim().min(1),
      }),
    )
    .length(3),
});

const bodySchema = z.object({
  listingId: z.string().min(1),
  source: z.string().trim().min(1),
  provenance: z.object({
    source: z.string().trim().min(1),
    sourceUrl: z.string().trim().min(1),
    retrievedAt: z.string().trim().min(1),
    fields: z.array(z.string()),
  }),
  payload: z.union([listingPayloadSchema, outreachPayloadSchema]),
});

export async function GET() {
  if (!isConciergeOnboardingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: { code: 'forbidden' } }, { status: 403 });
  }
  const rows = await listConciergeDrafts();
  return NextResponse.json({ items: rows });
}

export async function POST(req: Request) {
  if (!isConciergeOnboardingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
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
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const result = await storeConciergeDraft(parsed.data);
  return NextResponse.json(result.body, { status: result.status });
}
