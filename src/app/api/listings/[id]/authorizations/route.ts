// Grant or withdraw scopes. The actor must be a verified representative for
// this listing. Listing ownership is not enough. A contact listing cannot be
// granted out of its restriction.

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  isSchoolMediatedInstructorsOn,
  scopeGrantByRoleDecision,
} from '@/lib/acquisition/mediated-instructor-policy';
import { prisma } from '@/lib/db';
import {
  AuthorizationCommandError,
  appendAuthorizationEvent,
  loadFoldedAuthorization,
  loadListingSurfaces,
} from '@/lib/orgs/school-authorization';
import { AUTHORIZATION_SCOPES } from '@/lib/orgs/school-authorization-policy';
import { emptyScopeDecisionForm } from '@/lib/orgs/scope-decision-form';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function requireRepresentative(listingId: string, userId: string) {
  const representative = await prisma.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId, userId } },
  });
  return Boolean(representative?.verifiedAt && representative.evidenceRef);
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id: listingId } = await ctx.params;
  if (!(await requireRepresentative(listingId, user.id))) {
    return NextResponse.json({ error: { code: 'not_representative' } }, { status: 403 });
  }
  const folded = await loadFoldedAuthorization(listingId);
  return NextResponse.json({
    listingId,
    headSequence: folded.headSequence,
    decisionVersion: folded.decisionVersion,
    granted: folded.granted,
    withdrawn: folded.withdrawn,
    form: emptyScopeDecisionForm(),
  });
}

const bodySchema = z.object({
  kind: z.enum(['grant', 'withdraw']),
  scopes: z.array(z.enum(AUTHORIZATION_SCOPES)),
  evidenceRef: z.string().trim().min(1).max(500),
  note: z.string().trim().max(2000).optional(),
  expectedHeadSequence: z.number().int().nonnegative(),
  decisionVersion: z.number().int().positive(),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id: listingId } = await ctx.params;
  if (isSchoolMediatedInstructorsOn()) {
    const profile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { signupPath: true },
    });
    const representative = await prisma.listingRepresentativeAuthority.findUnique({
      where: { listingId_userId: { listingId, userId: user.id } },
    });
    const grant = scopeGrantByRoleDecision({
      enforced: true,
      actorIsSchool: profile?.signupPath === 'SCHOOL',
      representativeVerified: Boolean(representative?.verifiedAt && representative.evidenceRef),
    });
    if (!grant.allowed) {
      return NextResponse.json({ error: { code: grant.code } }, { status: 403 });
    }
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const folded = await loadFoldedAuthorization(listingId);
  if (
    parsed.data.expectedHeadSequence !== folded.headSequence ||
    parsed.data.decisionVersion !== folded.decisionVersion + 1
  ) {
    return NextResponse.json({ error: 'stale' }, { status: 409 });
  }

  try {
    const written = await appendAuthorizationEvent({
      listingId,
      kind: parsed.data.kind,
      scopes: parsed.data.scopes,
      actorUserId: user.id,
      evidenceRef: parsed.data.evidenceRef,
      note: parsed.data.note ?? null,
      expectedHeadSequence: parsed.data.expectedHeadSequence,
      decisionVersion: parsed.data.decisionVersion,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    if (parsed.data.kind === 'grant') {
      const open = await prisma.schoolComplaint.findMany({
        where: { listingId, state: { in: ['SUSPENDED', 'VERIFIED_DISABLED'] } },
      });
      const restored = open
        .filter((row) =>
          row.disputedScopes.every((scope) => parsed.data.scopes.includes(scope as never)),
        )
        .map((row) => row.id);
      if (restored.length > 0) {
        await prisma.schoolComplaint.updateMany({
          where: { id: { in: restored } },
          data: { state: 'RESOLVED' },
        });
      }
    }
    const instructor = await prisma.instructor.findUnique({
      where: { id: listingId },
      select: { bookingMode: true },
    });
    const surfaces = await loadListingSurfaces(listingId, instructor?.bookingMode);
    return NextResponse.json({ replay: written.replay, sequence: written.sequence, surfaces });
  } catch (error) {
    if (error instanceof AuthorizationCommandError) {
      const status = error.code === 'stale' ? 409 : 403;
      return NextResponse.json({ error: error.code }, { status });
    }
    throw error;
  }
}
