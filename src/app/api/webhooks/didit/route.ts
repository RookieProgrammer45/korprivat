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
  verifyDiditRequest,
  type ParsedDiditWebhook,
} from '@/lib/verification/didit';
import {
  type LearnerVerificationState,
  resolveLearnerState,
} from '@/lib/verification/state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Session webhook families that can drive the learner age-gate writer. */
const LEARNER_SESSION_WEBHOOK_TYPES = new Set([
  'status.updated',
  'data.updated',
]);

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
  const signatureV2 = req.headers.get('x-signature-v2');
  const signatureRaw = req.headers.get('x-signature');
  const signatureSimple = req.headers.get('x-signature-simple');
  const timestamp = req.headers.get('x-timestamp');

  let jsonBody: unknown;
  try {
    jsonBody = JSON.parse(rawBody) as unknown;
  } catch {
    alertDiditWebhook('invalid_json', {
      bodyPreview: rawBody.slice(0, 512),
    });
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const verified = verifyDiditRequest({
    rawBody,
    jsonBody,
    signatureV2,
    signatureRaw,
    signatureSimple,
    timestamp,
  });

  if (!verified.ok) {
    alertDiditWebhook('invalid_signature', {
      bodyPreview: rawBody.slice(0, 512),
      hasV2: Boolean(signatureV2),
      hasRaw: Boolean(signatureRaw),
      hasSimple: Boolean(signatureSimple),
      hasTimestamp: Boolean(timestamp),
    });
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  let parsed: ParsedDiditWebhook;
  try {
    parsed = parseDiditWebhook(jsonBody);
  } catch (error) {
    if (error instanceof DiditWebhookParseError) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }
    throw error;
  }

  // Simple authenticates the envelope only — never trust decision / DOB from it.
  parsed.decisionTrusted = verified.method === 'v2' || verified.method === 'raw';

  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');

  // Idempotency: Didit event_id is the delivery key (docs).
  try {
    await prisma.diditWebhookEvent.create({
      data: {
        eventId: parsed.eventId,
        diditSessionId: parsed.sessionId ?? parsed.eventId,
        decision: parsed.statusLabel || parsed.webhookType,
        webhookType: parsed.webhookType,
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

  // Ack non-learner families immediately (entity / activity / transaction / KYB).
  if (!LEARNER_SESSION_WEBHOOK_TYPES.has(parsed.webhookType)) {
    return NextResponse.json(
      { ok: true, ignored: true, webhook_type: parsed.webhookType },
      { status: 200 },
    );
  }

  if (parsed.sessionKind === 'business') {
    return NextResponse.json(
      { ok: true, ignored: true, reason: 'business_session' },
      { status: 200 },
    );
  }

  if (!parsed.decision) {
    return NextResponse.json(
      { ok: true, ignored: true, reason: 'unknown_status' },
      { status: 200 },
    );
  }

  // Approved DOB writes require a body-authenticating signature.
  if (parsed.decision === 'approved' && !parsed.decisionTrusted) {
    alertDiditWebhook('approved_without_trusted_signature', {
      eventId: parsed.eventId,
      sessionId: parsed.sessionId,
      method: verified.method,
    });
    return NextResponse.json(
      { ok: true, deferred: true, reason: 'decision_untrusted' },
      { status: 200 },
    );
  }

  const userId = parsed.vendorData.trim();
  if (!userId) {
    alertDiditWebhook('missing_vendor_data', {
      eventId: parsed.eventId,
      sessionId: parsed.sessionId,
    });
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
      eventId: parsed.eventId,
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
        ...(parsed.decision === 'approved' &&
        parsed.decisionTrusted &&
        parsed.verifiedDob
          ? { dateOfBirthVerified: parsed.verifiedDob }
          : {}),
        verificationState: nextState,
        diditAttempts: nextAttempts,
        ...(parsed.sessionId ? { diditSessionId: parsed.sessionId } : {}),
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
        note: `Didit ${parsed.webhookType} decision=${parsed.decision} session=${parsed.sessionId ?? 'n/a'} event=${parsed.eventId}`,
        metadata: {
          eventId: parsed.eventId,
          webhookType: parsed.webhookType,
          statusLabel: parsed.statusLabel,
          signatureMethod: verified.method,
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
