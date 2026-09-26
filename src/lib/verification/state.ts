/**
 * Pure learner verification state resolution.
 * No Prisma, no I/O — clock only via injected `now`.
 */

import { ageInYears, HANDLEDARE_CEILING_AGE, MINIMUM_AGE } from './age';

export type LearnerVerificationState =
  | 'SIGNED_UP'
  | 'BLOCKED_UNDERAGE'
  | 'DIDIT_PENDING'
  | 'DIDIT_FAILED'
  | 'MANUAL_REVIEW'
  | 'HANDLEDARE_PENDING'
  | 'HANDLEDARE_EXPIRED'
  | 'ACTIVE'
  | 'SUSPENDED';

export type DiditDecision = 'approved' | 'declined' | 'in_review' | 'expired' | 'abandoned';

export interface HandledareEnrollmentSnapshot {
  status: 'PENDING' | 'APPROVED' | 'REVOKED';
  expiresAt: Date;
}

export interface ResolveInput {
  /** Current persisted state — tie-breaker for in-flight Didit and terminal states. */
  currentState: LearnerVerificationState;
  /** Untrusted DOB from the signup form. Routing only. */
  claimedDob?: Date | null;
  /** Authoritative DOB from Didit. The only source that can gate on verified age. */
  verifiedDob?: Date | null;
  /** Latest decision from Didit. Null if no session has completed yet. */
  diditDecision?: DiditDecision | null;
  /** Number of completed Didit attempts (declined/expired/abandoned). */
  diditAttempts: number;
  /** Current handledare enrollment, if any. */
  handledareEnrollment?: HandledareEnrollmentSnapshot | null;
  /** Injectable clock for tests. */
  now?: Date;
}

export const DIDIT_MAX_ATTEMPTS = 3;

/**
 * Resolves learner verification state from facts (idempotent / replay-safe).
 * Transition rules T1–T11 from docs/learner-verification-flow.md.
 */
export function resolveLearnerState(input: ResolveInput): LearnerVerificationState {
  const now = input.now ?? new Date();

  if (input.currentState === 'SUSPENDED') return 'SUSPENDED';

  // ---- Verified DOB is authoritative. Gate on it first. ----
  if (input.verifiedDob) {
    const verifiedAge = ageInYears(input.verifiedDob, now);

    // T3 — verified underage always wins over claimed DOB.
    if (verifiedAge < MINIMUM_AGE) {
      return 'BLOCKED_UNDERAGE';
    }

    // T5 / T4 / T9 / T10 — only once Didit has approved.
    if (input.diditDecision === 'approved') {
      if (verifiedAge >= HANDLEDARE_CEILING_AGE) {
        return 'ACTIVE';
      }

      const enrollment = input.handledareEnrollment;
      if (enrollment?.status === 'APPROVED') return 'ACTIVE';
      if (enrollment?.status === 'REVOKED') return 'HANDLEDARE_PENDING';
      if (enrollment && enrollment.expiresAt.getTime() < now.getTime()) {
        return 'HANDLEDARE_EXPIRED';
      }
      return 'HANDLEDARE_PENDING';
    }
  }

  // ---- Didit outcomes that aren't approval. ----
  switch (input.diditDecision) {
    case 'in_review':
      return 'DIDIT_PENDING';

    case 'declined':
    case 'expired':
    case 'abandoned':
      // T6 / T8
      return input.diditAttempts >= DIDIT_MAX_ATTEMPTS ? 'MANUAL_REVIEW' : 'DIDIT_FAILED';

    default:
      break;
  }

  // Preserve in-flight Didit (and failed-awaiting-retry) before claimed-DOB T2.
  if (input.currentState === 'DIDIT_PENDING') {
    return 'DIDIT_PENDING';
  }
  if (input.currentState === 'DIDIT_FAILED') {
    return 'DIDIT_FAILED';
  }
  if (input.currentState === 'MANUAL_REVIEW') {
    return 'MANUAL_REVIEW';
  }

  // ---- No verified approval path. Claimed DOB for routing only. ----
  if (input.claimedDob) {
    const claimedAge = ageInYears(input.claimedDob, now);

    // T1
    if (claimedAge < MINIMUM_AGE) return 'BLOCKED_UNDERAGE';

    // T2 — eligible, needs Didit (or already mid-flow handled above).
    return 'SIGNED_UP';
  }

  return 'SIGNED_UP';
}

/** App route for a verification state (live surfaces — ADR-001). */
export function stateToRoute(state: LearnerVerificationState): string {
  switch (state) {
    // TODO(verification): Move to /onboarding/learner when that route ships.
    case 'SIGNED_UP':
      return '/dashboard/student';
    case 'BLOCKED_UNDERAGE':
      return '/signup?blocked=underage';
    case 'SUSPENDED':
      return '/signup?blocked=suspended';
    // Soft-gate: incomplete verification still uses the student dashboard;
    // booking/checkout will call requireActiveLearner once Didit persists verified DOB.
    case 'DIDIT_PENDING':
    case 'DIDIT_FAILED':
    case 'MANUAL_REVIEW':
    case 'HANDLEDARE_PENDING':
    case 'HANDLEDARE_EXPIRED':
      return '/dashboard/student';
    case 'ACTIVE':
      return '/dashboard/student';
  }
}
