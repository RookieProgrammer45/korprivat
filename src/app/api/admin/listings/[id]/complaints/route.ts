// Operator path: record a complaint and suspend the disputed scopes immediately.
// The response includes the live surface flags so the operator can see that
// the public booking surfaces are off. Restoring a scope is a separate grant
// from a verified representative — this route cannot grant.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  AuthorizationCommandError,
  appendAuthorizationEvent,
  loadFoldedAuthorization,
  loadListingSurfaces,
} from '@/lib/orgs/school-authorization';
import {
  AUTHORIZATION_SCOPES,
  type AuthorizationScope,
} from '@/lib/orgs/school-authorization-policy';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  summary: z.string().trim().min(1).max(2000),
  evidenceRef: z.string().trim().min(1).max(500),
  disputedScopes: z.array(z.enum(AUTHORIZATION_SCOPES)).min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
});

async function adminUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') return null;
  return session.user.id;
}

function scopeOff(
  surfaces: Awaited<ReturnType<typeof loadListingSurfaces>>,
  scope: AuthorizationScope,
): boolean {
  if (scope === 'availability_display') return !surfaces.availabilityDisplay;
  if (scope === 'inquiry_collection') return !surfaces.inquiryCollection;
  if (scope === 'request_to_book') return !surfaces.requestToBook;
  if (scope === 'transactional_booking') return !surfaces.transactionalBooking;
  return true;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const actorUserId = await adminUserId();
  if (!actorUserId) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { id: listingId } = await ctx.params;
  const instructor = await prisma.instructor.findUnique({
    where: { id: listingId },
    select: { id: true, bookingMode: true },
  });
  if (!instructor) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const folded = await loadFoldedAuthorization(listingId);
  try {
    await appendAuthorizationEvent({
      listingId,
      kind: 'admin_suspend',
      scopes: parsed.data.disputedScopes,
      actorUserId,
      evidenceRef: parsed.data.evidenceRef,
      note: parsed.data.summary,
      expectedHeadSequence: folded.headSequence,
      decisionVersion: folded.decisionVersion + 1,
      idempotencyKey: parsed.data.idempotencyKey,
    });
  } catch (error) {
    if (error instanceof AuthorizationCommandError) {
      return NextResponse.json({ error: error.code }, { status: 409 });
    }
    throw error;
  }

  const surfaces = await loadListingSurfaces(listingId, instructor.bookingMode);
  const disabled = parsed.data.disputedScopes.every((scope) => scopeOff(surfaces, scope));
  const complaint = await prisma.schoolComplaint.create({
    data: {
      listingId,
      summary: parsed.data.summary,
      evidenceRef: parsed.data.evidenceRef,
      disputedScopes: parsed.data.disputedScopes,
      state: disabled ? 'VERIFIED_DISABLED' : 'SUSPENDED',
      verification: surfaces,
    },
  });

  return NextResponse.json({
    complaintId: complaint.id,
    state: complaint.state,
    surfaces,
  });
}
