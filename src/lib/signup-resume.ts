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
  type LearnerVerificationState,
  resolveLearnerState,
  stateToRoute,
} from '@/lib/verification/state';

const HARD_BLOCK_STATES = new Set<LearnerVerificationState>(['BLOCKED_UNDERAGE', 'SUSPENDED']);

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
    // TODO(verification): load HandledareEnrollment snapshot when that model ships.
    handledareEnrollment: null,
  });
}

/** Load claimed DOB and resolve verification state for dashboard UI (banner, etc.). */
export async function getStoredLearnerState(userId: string): Promise<LearnerVerificationState> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { dateOfBirth: true },
  });
  return resolveStoredLearnerState(profile?.dateOfBirth ?? null);
}

/**
 * Signed-in learners who already stored a claimed DOB leave /signup for
 * the route the state machine assigns (usually /dashboard/student). Hard
 * blocks stay on /signup?blocked=….
 */
export async function redirectLearnerAwayFromSignup(): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true, dateOfBirth: true },
  });
  if (profile?.role !== 'STUDENT' || !profile.dateOfBirth) return;

  const destination = stateToRoute(resolveStoredLearnerState(profile.dateOfBirth));
  if (!destination.startsWith('/signup')) redirect(destination);
}

/**
 * Hard gate for booking / checkout surfaces.
 * TODO(verification): Didit webhook slice must write dateOfBirthVerified
 * (and related facts) before this can return for real ACTIVE learners.
 * Do not wire into booking/checkout until that writer ships.
 */
export async function requireActiveLearner(userId: string): Promise<void> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { dateOfBirth: true },
  });

  const state = resolveLearnerState({
    currentState: 'SIGNED_UP',
    claimedDob: profile?.dateOfBirth ?? null,
    // TODO(verification): read dateOfBirthVerified once Didit webhook persists it.
    verifiedDob: null,
    diditDecision: null,
    diditAttempts: 0,
    // TODO(verification): load HandledareEnrollment snapshot when that model ships.
    handledareEnrollment: null,
  });

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
    const profile = await prisma.userProfile.findUnique({
      where: { userId },
      select: {
        dateOfBirth: true,
      },
    });

    // Claimed DOB is collected on /signup. Until it exists, send them back.
    if (!profile?.dateOfBirth) {
      redirect('/signup');
    }

    const state = resolveStoredLearnerState(profile.dateOfBirth);
    // Soft-gate: only hard-block underage / suspended. Other states may browse
    // /dashboard/student; booking uses requireActiveLearner later.
    if (HARD_BLOCK_STATES.has(state)) {
      redirect(stateToRoute(state));
    }
  }
}
