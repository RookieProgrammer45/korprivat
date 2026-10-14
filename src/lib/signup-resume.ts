// Mirrors GET /api/signup/state + POST /api/signup/complete so incomplete
// wizard users cannot bypass prerequisites by deep-linking into /dashboard.

import 'server-only';
import { redirect } from 'next/navigation';
import { confirmedPhotoUrl } from '@/lib/business/photo-verification';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { prisma } from '@/lib/db';
import { completeSignupHandshake } from '@/lib/email/onboarding';
import {
  createOrganization,
  listMembershipsForUser,
  OrgAlreadyExistsError,
} from '@/lib/orgs/service';
import { getSessionUser } from '@/lib/require-auth';
import {
  type DiditDecision,
  type LearnerVerificationState,
  resolveLearnerState,
  stateToRoute,
} from '@/lib/verification/state';

export type SchoolSignupCompleteResult =
  | { ok: true; next: string }
  | { ok: false; reason: 'not_school' | 'missing_fields' | 'org_conflict' };

/**
 * Idempotent SCHOOL path finish: persist role SCHOOL, then Organization +
 * OWNER Membership if missing.
 */
export async function ensureSchoolSignupComplete(user: {
  id: string;
  email: string;
  name: string | null | undefined;
  next?: string;
}): Promise<SchoolSignupCompleteResult> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: {
      signupPath: true,
      schoolName: true,
      organizationNumber: true,
      city: true,
    },
  });
  if (profile?.signupPath !== 'SCHOOL') {
    return { ok: false, reason: 'not_school' };
  }

  await prisma.userProfile.update({
    where: { userId: user.id },
    data: { role: 'SCHOOL' },
  });

  const schoolDestination =
    user.next?.startsWith('/invite/') ? user.next : '/dashboard/school';

  const existing = await listMembershipsForUser(user.id, { onlyActive: true });
  const alreadyMember = existing.some((m) => m.role === 'OWNER' || m.role === 'STAFF');
  if (!alreadyMember) {
    const schoolName = profile.schoolName?.trim();
    const organizationNumber = profile.organizationNumber?.trim();
    if (!schoolName || !organizationNumber) {
      return { ok: false, reason: 'missing_fields' };
    }
    try {
      await createOrganization({
        name: schoolName,
        organizationNumber,
        city: profile.city ?? undefined,
        ownerUserId: user.id,
        ownerEmail: user.email,
      });
    } catch (err) {
      if (err instanceof OrgAlreadyExistsError) {
        // Concurrent complete: winner may already have attached Membership.
        const again = await listMembershipsForUser(user.id, { onlyActive: true });
        if (!again.some((m) => m.role === 'OWNER' || m.role === 'STAFF')) {
          return { ok: false, reason: 'org_conflict' };
        }
      } else {
        throw err;
      }
    }
  }

  await completeSignupHandshake({
    userId: user.id,
    email: user.email,
    name: user.name,
    requestedRole: 'SCHOOL',
  });
  return { ok: true, next: schoolDestination };
}

export type SignedInSignupDisposition =
  | { kind: 'redirect'; to: string }
  | { kind: 'already_signed_in'; home: string; email: string }
  | { kind: 'continue_wizard' };

async function homeForSignedInUser(userId: string): Promise<string> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { role: true },
  });
  const memberships = await listMembershipsForUser(userId, { onlyActive: true });
  if (
    memberships.some((m) => m.role === 'OWNER' || m.role === 'STAFF') ||
    profile?.role === 'SCHOOL'
  ) {
    return '/dashboard/school';
  }
  if (profile?.role === 'INSTRUCTOR') return '/dashboard/instructor';
  if (profile?.role === 'HANDLEDARE') return '/dashboard/handledare';
  return '/dashboard/student';
}

/**
 * Signed-in /signup routing: finish SCHOOL membership when missing, otherwise
 * either keep mid-wizard steps or show the already-signed-in surface.
 */
export async function resolveSignedInSignup(
  user: { id: string; email: string; name: string | null | undefined; emailVerified: boolean },
  resumeNext?: string,
  requestedPath?: 'LEARNER' | 'SCHOOL' | 'INSTRUCTOR',
): Promise<SignedInSignupDisposition> {
  if (!user.emailVerified) {
    return { kind: 'continue_wizard' };
  }

  const school = await ensureSchoolSignupComplete({
    id: user.id,
    email: user.email,
    name: user.name,
    next: resumeNext,
  });
  if (school.ok) {
    return { kind: 'redirect', to: school.next.includes('?') ? school.next : `${school.next}?signup=1` };
  }
  // Missing org fields or org-number conflict — keep wizard / complete path.
  if (school.reason === 'missing_fields' || school.reason === 'org_conflict') {
    return { kind: 'continue_wizard' };
  }

  // A verified account that is not an in-progress school must not enter
  // learner verification from /signup?role=school.
  if (requestedPath === 'SCHOOL') {
    return {
      kind: 'already_signed_in',
      home: await homeForSignedInUser(user.id),
      email: user.email,
    };
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true, signupPath: true, dateOfBirth: true },
  });

  if (profile?.role === 'INSTRUCTOR') {
    if (!(await confirmedPhotoUrl(user.id))) {
      return { kind: 'continue_wizard' };
    }
    const license = await prisma.instructorLicense.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!license) return { kind: 'continue_wizard' };
  }

  if (profile?.role === 'HANDLEDARE') {
    const clickwrap = await prisma.clickwrapAcceptance.findUnique({
      where: { userId: user.id },
      select: { termsVersion: true },
    });
    if (clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION) {
      return { kind: 'continue_wizard' };
    }
  }

  // Learner mid-flow: still in the signup wizard until the profile photo step
  // is confirmed (profileCompletedAt). Claimed DOB is collected at signup-start,
  // so it must NOT be treated as flow completion — that dead-ended every
  // verified learner on the already-signed-in card right after email verify.
  if (profile?.role === 'STUDENT' && profile.signupPath !== 'SCHOOL') {
    const learnerState = await getStoredLearnerState(user.id);
    if (learnerState === 'ACTIVE') {
      return { kind: 'already_signed_in', home: '/dashboard/student', email: user.email };
    }
    return { kind: 'continue_wizard' };
  }

  const home =
    profile?.role === 'SCHOOL'
      ? '/dashboard/school'
      : await homeForSignedInUser(user.id);

  return { kind: 'already_signed_in', home, email: user.email };
}

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
  handledareEnrollment?: import('@/lib/verification/state').HandledareEnrollmentSnapshot | null;
};

/**
 * Facts we can read for learner verification.
 * Claimed DOB is routing only. Verified DOB is written only by the Didit webhook.
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
    handledareEnrollment: facts.handledareEnrollment ?? null,
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
  const { loadActiveHandledareEnrollment } = await import(
    '@/lib/verification/handledare-enrollment'
  );
  const handledareEnrollment = await loadActiveHandledareEnrollment(userId);
  return {
    claimedDob: profile.dateOfBirth,
    verifiedDob: profile.dateOfBirthVerified,
    currentState: asLearnerState(profile.verificationState),
    diditDecision: asDiditDecision(profile.diditLastDecision),
    diditAttempts: profile.diditAttempts,
    diditSessionId: profile.diditSessionId,
    handledareEnrollment,
  };
}

/** Load verification facts and resolve state for dashboard UI (banner, etc.). */
export async function getStoredLearnerState(userId: string): Promise<LearnerVerificationState> {
  const facts = await loadLearnerVerificationFacts(userId);
  if (!facts) return 'SIGNED_UP';
  return resolveLearnerStateFromFacts(facts);
}

/**
 * Booking / checkout eligibility.
 * Didit is paused: a learner with claimed age >= 16 (SIGNED_UP, or a
 * leftover DIDIT_* state) may book. Underage, suspended, manual review,
 * and handledare enrollment stays blocked. Verified DOB is not written here.
 */
const BOOKABLE_WITHOUT_DIDIT = new Set<LearnerVerificationState>([
  'ACTIVE',
  'SIGNED_UP',
  'DIDIT_PENDING',
  'DIDIT_FAILED',
]);

export async function resolveLearnerBookingGate(userId: string): Promise<
  | { eligible: true; state: LearnerVerificationState }
  | { eligible: false; state: LearnerVerificationState; redirectTo: string }
> {
  const facts = await loadLearnerVerificationFacts(userId);
  const state = facts
    ? resolveLearnerStateFromFacts(facts)
    : resolveStoredLearnerState(null);

  if (BOOKABLE_WITHOUT_DIDIT.has(state)) {
    return { eligible: true, state };
  }
  return { eligible: false, state, redirectTo: stateToRoute(state) };
}

/**
 * Hard gate for booking / checkout page surfaces.
 * Requires dateOfBirthVerified from the Didit webhook writer.
 */
export async function requireActiveLearner(userId: string): Promise<void> {
  const gate = await resolveLearnerBookingGate(userId);
  if (!gate.eligible) {
    redirect(gate.redirectTo);
  }
}

/**
 * Signed-in learners who already stored a claimed DOB leave /signup for
 * the route the state machine assigns (usually /onboarding/learner/verify).
 * Hard blocks stay on /signup?blocked=….
 *
 * When `resumeNext` is set (e.g. return to an instructor profile after auth),
 * prefer that same-origin path so booking context is not lost to Didit.
 */
export async function redirectLearnerAwayFromSignup(resumeNext?: string): Promise<void> {
  const user = await getSessionUser();
  if (!user) return;
  // Unverified emails stay on /signup (Step 2 — confirm email).
  if (!user.emailVerified) return;

  const facts = await loadLearnerVerificationFacts(user.id);
  if (!facts?.claimedDob) return;

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'STUDENT') return;

  if (resumeNext) {
    redirect(resumeNext);
  }

  const destination = stateToRoute(resolveLearnerStateFromFacts(facts));
  if (!destination.startsWith('/signup')) redirect(destination);
}

export async function requireSignupPrerequisites(
  userId: string,
  role: MarketplaceRole,
): Promise<void> {
  const authUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  });
  if (!authUser?.emailVerified) {
    redirect('/signup');
  }

  // School owners/staff enter via Membership, not learner DOB / instructor docs.
  const schoolMemberships = await listMembershipsForUser(userId, { onlyActive: true });
  if (schoolMemberships.some((m) => m.role === 'OWNER' || m.role === 'STAFF')) {
    return;
  }

  if (role === 'SCHOOL') {
    return;
  }

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
      select: { signupPath: true },
    });
    // SCHOOL signup collects org fields, not claimed DOB — do not bounce to /signup.
    if (profile?.signupPath === 'SCHOOL') {
      return;
    }

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
