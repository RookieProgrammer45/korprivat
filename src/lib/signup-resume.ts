// @polsia:user-owned — shared signup-resume gate for dashboard entry.
// Mirrors GET /api/signup/state + POST /api/signup/complete so incomplete
// wizard users cannot bypass prerequisites by deep-linking into /dashboard.

import 'server-only';
import { redirect } from 'next/navigation';
import { confirmedPhotoUrl } from '@/lib/business/photo-verification';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/require-auth';
import {
  type DiditDecision,
  type LearnerVerificationState,
  resolveLearnerState,
  stateToRoute,
} from '@/lib/verification/state';

const HARD_BLOCK_STATES = new Set<LearnerVerificationState>(['BLOCKED_UNDERAGE', 'SUSPENDED']);

const LEARNER_STATES = new Set<LearnerVerificationState>([
  'SIGNED_UP',
  'BLOCKED_UNDERAGE',
  'DIDIT_PENDING',
  'DIDIT_FAILED',
  'MANUAL_REVIEW',
  'HANDLEDARE_PENDING',
  'HANDLEDARE_EXPIRED',
  'ACTIVE',
  'SUSPENDED',
]);

function asLearnerState(value: string | null | undefined): LearnerVerificationState {
  if (value && LEARNER_STATES.has(value as LearnerVerificationState)) {
    return value as LearnerVerificationState;
  }
  return 'SIGNED_UP';
}

function asDiditDecision(value: string | null | undefined): DiditDecision | null {
  if (
    value === 'approved' ||
    value === 'declined' ||
    value === 'in_review' ||
    value === 'expired' ||
    value === 'abandoned'
  ) {
    return value;
  }
  return null;
}

export type LearnerVerificationFacts = {
  claimedDob: Date | null;
  verifiedDob: Date | null;
  currentState: LearnerVerificationState;
  diditDecision: DiditDecision | null;
  diditAttempts: number;
  diditSessionId: string | null;
};

/**
 * Facts we can read before Didit persistence exists.
 * Claimed DOB is routing only. Verified DOB stays null until the Didit writer ships.
 */
export function resolveStoredLearnerState(
  claimedDob: Date | null | undefined,
): LearnerVerificationState {
  return resolveLearnerState({
    currentState: 'SIGNED_UP',
    claimedDob: claimedDob ?? null,
    verifiedDob: null,
    diditDecision: null,
    diditAttempts: 0,
    handledareEnrollment: null,
  });
}

export function resolveLearnerStateFromFacts(
  facts: LearnerVerificationFacts,
): LearnerVerificationState {
  return resolveLearnerState({
    currentState: facts.currentState,
    claimedDob: facts.claimedDob,
    verifiedDob: facts.verifiedDob,
    diditDecision: facts.diditDecision,
    diditAttempts: facts.diditAttempts,
    // TODO(verification): load HandledareEnrollment snapshot when that model ships.
    handledareEnrollment: null,
  });
}

export async function loadLearnerVerificationFacts(
  userId: string,
): Promise<LearnerVerificationFacts | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      dateOfBirth: true,
      dateOfBirthVerified: true,
      verificationState: true,
      diditAttempts: true,
      diditLastDecision: true,
      diditSessionId: true,
    },
  });
  if (!profile) return null;
  return {
    claimedDob: profile.dateOfBirth,
    verifiedDob: profile.dateOfBirthVerified,
    currentState: asLearnerState(profile.verificationState),
    diditDecision: asDiditDecision(profile.diditLastDecision),
    diditAttempts: profile.diditAttempts,
    diditSessionId: profile.diditSessionId,
  };
}

/** Load verification facts and resolve state for dashboard UI (banner, etc.). */
export async function getStoredLearnerState(userId: string): Promise<LearnerVerificationState> {
  const facts = await loadLearnerVerificationFacts(userId);
  if (!facts) return 'SIGNED_UP';
  return resolveLearnerStateFromFacts(facts);
}

/**
 * Signed-in learners who already stored a claimed DOB leave /signup for
 * the route the state machine assigns (usually /onboarding/learner/verify).
 * Hard blocks stay on /signup?blocked=….
 */
export async function redirectLearnerAwayFromSignup(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const facts = await loadLearnerVerificationFacts(user.id);
  if (!facts?.claimedDob) return;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'STUDENT') return;

  const destination = stateToRoute(resolveLearnerStateFromFacts(facts));
  if (!destination.startsWith('/signup')) redirect(destination);
}

/**
 * Hard gate for booking / checkout surfaces.
 * Requires dateOfBirthVerified from the Didit webhook writer.
 */
export async function requireActiveLearner(userId: string): Promise<void> {
  const facts = await loadLearnerVerificationFacts(userId);
  const state = facts
    ? resolveLearnerStateFromFacts(facts)
    : resolveStoredLearnerState(null);

  if (state !== 'ACTIVE') {
    redirect(stateToRoute(state));
  }
}

export async function requireSignupPrerequisites(
  userId: string,
  role: MarketplaceRole,
): Promise<void> {
  if (role === 'INSTRUCTOR') {
    if (!(await confirmedPhotoUrl(userId))) {
      redirect('/signup');
    }
    const license = await prisma.instructorLicense.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!license) redirect('/signup');
    return;
  }
  if (role === 'HANDLEDARE') {
    const clickwrap = await prisma.clickwrapAcceptance.findUnique({
      where: { userId },
      select: { termsVersion: true },
    });
    if (clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION) {
      redirect('/signup');
    }
    return;
  }

  if (role === 'STUDENT') {
    const facts = await loadLearnerVerificationFacts(userId);

    // Claimed DOB is collected on /signup. Until it exists, send them back.
    if (!facts?.claimedDob) {
      redirect('/signup');
    }

    const state = resolveLearnerStateFromFacts(facts);
    // Soft-gate: only hard-block underage / suspended. Other states may browse
    // /dashboard/student; booking uses requireActiveLearner later.
    if (HARD_BLOCK_STATES.has(state)) {
      redirect(stateToRoute(state));
    }
  }
}
