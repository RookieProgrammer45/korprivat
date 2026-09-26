// @polsia:user-owned — Didit ID-verification webhook writer.
// The ONLY code path allowed to write UserProfile.dateOfBirthVerified.

import 'server-only';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  alertDiditWebhook,
  DiditWebhookParseError,
  parseDiditWebhook,
  verifyDiditSignature,
} from '@/lib/verification/didit';
import {
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

function claimedVerifiedMismatchYears(
  claimed: Date | null,
  verified: Date | null,
): number | null {
  if (!claimed || !verified) return null;
  const ms = Math.abs(claimed.getTime() - verified.getTime());
  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get('x-didit-signature');

  if (!verifyDiditSignature(rawBody, signature)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let parsed;
  try {
    parsed = parseDiditWebhook(JSON.parse(rawBody) as unknown);
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof DiditWebhookParseError) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    throw error;
  }

  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  try {
    await prisma.diditWebhookEvent.create({
      data: {
        diditSessionId: parsed.sessionId,
        decision: parsed.decision,
        payloadHash,
      },
    });
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json({ duplicate: true }, { status: 200 });
    }
    throw error;
  }

  const userId = parsed.vendorData.trim();
  if (!userId) {
    alertDiditWebhook('missing_vendor_data', { sessionId: parsed.sessionId });
    return NextResponse.json({ ignored: true }, { status: 200 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      userId: true,
      dateOfBirth: true,
      dateOfBirthVerified: true,
      verificationState: true,
      diditAttempts: true,
    },
  });

  if (!profile) {
    alertDiditWebhook('unknown_vendor_data', {
      userId,
      sessionId: parsed.sessionId,
    });
    return NextResponse.json({ ignored: true }, { status: 200 });
  }

  const isFailedAttempt =
    parsed.decision === 'declined' ||
    parsed.decision === 'expired' ||
    parsed.decision === 'abandoned';
  const nextAttempts = isFailedAttempt
    ? profile.diditAttempts + 1
    : profile.diditAttempts;

  const currentState = isLearnerState(profile.verificationState)
    ? profile.verificationState
    : 'SIGNED_UP';

  const verifiedDob = parsed.verifiedDob ?? profile.dateOfBirthVerified;

  let nextState = resolveLearnerState({
    currentState,
    claimedDob: profile.dateOfBirth,
    verifiedDob,
    diditDecision: parsed.decision,
    diditAttempts: nextAttempts,
    handledareEnrollment: null,
  });

  // §8 — claimed vs verified mismatch > 1 year → flag for review.
  const mismatchYears = claimedVerifiedMismatchYears(
    profile.dateOfBirth,
    parsed.verifiedDob,
  );
  if (
    parsed.decision === 'approved' &&
    mismatchYears !== null &&
    mismatchYears > 1 &&
    nextState !== 'BLOCKED_UNDERAGE' &&
    nextState !== 'SUSPENDED'
  ) {
    nextState = 'MANUAL_REVIEW';
  }

  await prisma.$transaction(async (tx) => {
    await tx.userProfile.update({
      where: { userId },
      data: {
        ...(parsed.decision === 'approved' && parsed.verifiedDob
          ? { dateOfBirthVerified: parsed.verifiedDob }
          : {}),
        verificationState: nextState,
        diditAttempts: nextAttempts,
        diditSessionId: parsed.sessionId,
        diditLastDecision: parsed.decision,
        diditLastReason: parsed.reason,
      },
    });

    await tx.verificationEvent.create({
      data: {
        subjectType: 'LEARNER',
        subjectId: userId,
        fromStatus: currentState,
        toStatus: nextState,
        note: `Didit decision=${parsed.decision} session=${parsed.sessionId}`,
        metadata: {
          claimedDob: profile.dateOfBirth?.toISOString() ?? null,
          verifiedDob: verifiedDob?.toISOString() ?? null,
          attempts: nextAttempts,
          mismatchYears,
          firstName: parsed.firstName,
          lastName: parsed.lastName,
          documentType: parsed.documentType,
          documentNumber: parsed.documentNumber,
          nationality: parsed.nationality,
          livenessPassed: parsed.livenessPassed,
        } as Prisma.InputJsonValue,
      },
    });
  });

  return NextResponse.json({ ok: true, state: nextState }, { status: 200 });
}
