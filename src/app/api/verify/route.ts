// @polsia:user-owned — Create Didit KYC session (Verification context).
// Returns { url, session_id } for the web SDK / iframe / redirect.
// The API key never leaves the server. Webhook remains source of truth.

import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { siteUrl } from '@/lib/site';
import {
  createDiditSession,
  DiditSessionCreateError,
} from '@/lib/verification/didit';
import {
  DIDIT_MAX_ATTEMPTS,
  type LearnerVerificationState,
  resolveLearnerState,
} from '@/lib/verification/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isLearnerState(value: string): value is LearnerVerificationState {
  return (
    value === 'SIGNED_UP' ||
    value === 'BLOCKED_UNDERAGE' ||
    value === 'DIDIT_PENDING' ||
    value === 'DIDIT_FAILED' ||
    value === 'MANUAL_REVIEW' ||
    value === 'HANDLEDARE_PENDING' ||
    value === 'HANDLEDARE_EXPIRED' ||
    value === 'ACTIVE' ||
    value === 'SUSPENDED'
  );
}

/** States allowed to start or retry a Didit KYC session. */
function canStartDidit(state: LearnerVerificationState, attempts: number): boolean {
  if (state === 'SIGNED_UP') return true;
  if (state === 'DIDIT_PENDING') return true; // re-open lost URL
  if (state === 'DIDIT_FAILED' && attempts < DIDIT_MAX_ATTEMPTS) return true;
  return false;
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  if (!user.emailVerified) {
    return NextResponse.json({ error: 'email_unverified' }, { status: 403 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: {
      userId: true,
      role: true,
      dateOfBirth: true,
      dateOfBirthVerified: true,
      verificationState: true,
      diditAttempts: true,
      diditLastDecision: true,
    },
  });

  if (!profile || profile.role !== 'STUDENT') {
    return NextResponse.json({ error: 'no_learner_profile' }, { status: 404 });
  }

  const currentState = isLearnerState(profile.verificationState)
    ? profile.verificationState
    : 'SIGNED_UP';

  const lastDecision =
    profile.diditLastDecision === 'approved' ||
    profile.diditLastDecision === 'declined' ||
    profile.diditLastDecision === 'in_review' ||
    profile.diditLastDecision === 'expired' ||
    profile.diditLastDecision === 'abandoned'
      ? profile.diditLastDecision
      : null;

  const state = resolveLearnerState({
    currentState,
    claimedDob: profile.dateOfBirth,
    verifiedDob: profile.dateOfBirthVerified,
    diditDecision: lastDecision,
    diditAttempts: profile.diditAttempts,
    handledareEnrollment: null,
  });

  // Prefer persisted gate — never re-open KYC for terminal verified states.
  if (
    currentState === 'ACTIVE' ||
    currentState === 'BLOCKED_UNDERAGE' ||
    currentState === 'SUSPENDED' ||
    currentState === 'MANUAL_REVIEW' ||
    currentState === 'HANDLEDARE_PENDING' ||
    currentState === 'HANDLEDARE_EXPIRED' ||
    !canStartDidit(state, profile.diditAttempts)
  ) {
    return NextResponse.json({ error: 'invalid_state', state }, { status: 409 });
  }

  // Claimed DOB must be on file before ID verification (T2).
  if (!profile.dateOfBirth) {
    return NextResponse.json({ error: 'missing_claimed_dob' }, { status: 400 });
  }

  const callbackUrl = `${siteUrl}/onboarding/learner/verify`;

  let session: { sessionId: string; url: string };
  try {
    session = await createDiditSession({
      userId: user.id,
      claimedDob: profile.dateOfBirth,
      callbackUrl,
    });
  } catch (error) {
    if (error instanceof DiditSessionCreateError) {
      return NextResponse.json(
        { error: 'session_create_failed', detail: error.detail },
        { status: 502 },
      );
    }
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({
      where: { userId: user.id },
      data: {
        diditSessionId: session.sessionId,
        verificationState: 'DIDIT_PENDING',
      },
    });

    await tx.verificationEvent.create({
      data: {
        subjectType: 'LEARNER',
        subjectId: user.id,
        fromStatus: currentState,
        toStatus: 'DIDIT_PENDING',
        note: `Didit session ${session.sessionId} created`,
        metadata: {
          sessionId: session.sessionId,
          callbackUrl,
        } as Prisma.InputJsonValue,
      },
    });
  });

  // Return ONLY what the client needs — never session_token to web unless native.
  return NextResponse.json({
    url: session.url,
    session_id: session.sessionId,
  });
}
