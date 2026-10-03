// POST /api/verification/handledare/invite — learner sends handledare invite.

import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { loadLearnerVerificationFacts, resolveLearnerStateFromFacts } from '@/lib/signup-resume';
import { createHandledareInvite } from '@/lib/verification/handledare-enrollment';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  handledareEmail: z.string().email(),
  handledareName: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

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

  const facts = await loadLearnerVerificationFacts(user.id);
  if (!facts?.verifiedDob) {
    return NextResponse.json({ error: 'verification_required' }, { status: 403 });
  }
  const state = resolveLearnerStateFromFacts(facts);
  if (
    state !== 'HANDLEDARE_PENDING' &&
    state !== 'HANDLEDARE_EXPIRED' &&
    state !== 'DIDIT_PENDING'
  ) {
    return NextResponse.json({ error: 'not_eligible', state }, { status: 409 });
  }

  const result = await createHandledareInvite({
    learnerUserId: user.id,
    handledareEmail: parsed.data.handledareEmail,
    handledareName: parsed.data.handledareName,
    learnerName: user.name,
  });

  return NextResponse.json({
    ok: true,
    enrollmentId: result.enrollmentId,
    expiresAt: result.expiresAt.toISOString(),
  });
}
