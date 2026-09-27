// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { HANDLEDARE_CEILING_AGE, MINIMUM_AGE } from '@/lib/verification/age';
import {
  DIDIT_MAX_ATTEMPTS,
  type LearnerVerificationState,
  type ResolveInput,
  resolveLearnerState,
  stateToRoute,
} from '@/lib/verification/state';

/** Fixed "today" for deterministic age math: 2026-09-26 UTC. */
const NOW = new Date(Date.UTC(2026, 8, 26));

function dobYearsAgo(years: number, dayOffset = 0): Date {
  return new Date(Date.UTC(2026 - years, 8, 26 + dayOffset));
}

function resolve(
  partial: Partial<ResolveInput> & Pick<ResolveInput, 'currentState'>,
): LearnerVerificationState {
  return resolveLearnerState({
    diditAttempts: 0,
    now: NOW,
    ...partial,
  });
}

describe('resolveLearnerState', () => {
  it('T1: SIGNED_UP → BLOCKED_UNDERAGE when claimed age < 16', () => {
    expect(
      resolve({
        currentState: 'SIGNED_UP',
        claimedDob: dobYearsAgo(MINIMUM_AGE - 1),
      }),
    ).toBe('BLOCKED_UNDERAGE');
  });

  it('T2: SIGNED_UP → SIGNED_UP (eligible, needs Didit) when claimed age >= 16', () => {
    expect(
      resolve({
        currentState: 'SIGNED_UP',
        claimedDob: dobYearsAgo(MINIMUM_AGE),
      }),
    ).toBe('SIGNED_UP');
  });

  it('T3: DIDIT_PENDING → BLOCKED_UNDERAGE when approved and verified age < 16', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        claimedDob: dobYearsAgo(17),
        verifiedDob: dobYearsAgo(MINIMUM_AGE - 1),
        diditDecision: 'approved',
      }),
    ).toBe('BLOCKED_UNDERAGE');
  });

  it('T4: DIDIT_PENDING → HANDLEDARE_PENDING when approved and 16 <= verified < 18', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        verifiedDob: dobYearsAgo(17),
        diditDecision: 'approved',
        handledareEnrollment: null,
      }),
    ).toBe('HANDLEDARE_PENDING');
  });

  it('T5: DIDIT_PENDING → ACTIVE when approved and verified age >= 18', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        verifiedDob: dobYearsAgo(HANDLEDARE_CEILING_AGE),
        diditDecision: 'approved',
      }),
    ).toBe('ACTIVE');
  });

  it('T6: DIDIT_PENDING → DIDIT_FAILED on declined/expired/abandoned with attempts < max', () => {
    for (const decision of ['declined', 'expired', 'abandoned'] as const) {
      expect(
        resolve({
          currentState: 'DIDIT_PENDING',
          claimedDob: dobYearsAgo(20),
          diditDecision: decision,
          diditAttempts: 1,
        }),
      ).toBe('DIDIT_FAILED');
    }
  });

  it('T7: DIDIT_FAILED → DIDIT_PENDING when user retries (currentState after retry action)', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        claimedDob: dobYearsAgo(20),
        diditDecision: null,
        diditAttempts: 1,
      }),
    ).toBe('DIDIT_PENDING');
  });

  it('T8: DIDIT_FAILED → MANUAL_REVIEW when attempts >= max', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        claimedDob: dobYearsAgo(20),
        diditDecision: 'declined',
        diditAttempts: DIDIT_MAX_ATTEMPTS,
      }),
    ).toBe('MANUAL_REVIEW');
  });

  it('T9: HANDLEDARE_PENDING → ACTIVE when enrollment APPROVED', () => {
    expect(
      resolve({
        currentState: 'HANDLEDARE_PENDING',
        verifiedDob: dobYearsAgo(17),
        diditDecision: 'approved',
        handledareEnrollment: {
          status: 'APPROVED',
          expiresAt: new Date(Date.UTC(2026, 10, 1)),
        },
      }),
    ).toBe('ACTIVE');
  });

  it('T10: HANDLEDARE_PENDING → HANDLEDARE_EXPIRED when enrollment past expiresAt', () => {
    expect(
      resolve({
        currentState: 'HANDLEDARE_PENDING',
        verifiedDob: dobYearsAgo(17),
        diditDecision: 'approved',
        handledareEnrollment: {
          status: 'PENDING',
          expiresAt: new Date(Date.UTC(2026, 8, 1)),
        },
      }),
    ).toBe('HANDLEDARE_EXPIRED');
  });

  it('T11: HANDLEDARE_EXPIRED → HANDLEDARE_PENDING when resend creates fresh PENDING enrollment', () => {
    expect(
      resolve({
        currentState: 'HANDLEDARE_EXPIRED',
        verifiedDob: dobYearsAgo(17),
        diditDecision: 'approved',
        handledareEnrollment: {
          status: 'PENDING',
          expiresAt: new Date(Date.UTC(2026, 10, 1)),
        },
      }),
    ).toBe('HANDLEDARE_PENDING');
  });

  it('preserves DIDIT_PENDING when session is in flight (no decision yet)', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        claimedDob: dobYearsAgo(20),
        diditDecision: null,
        verifiedDob: null,
      }),
    ).toBe('DIDIT_PENDING');
  });

  it('claimed DOB ≥16 but verified DOB <16 → BLOCKED_UNDERAGE (verified wins)', () => {
    expect(
      resolve({
        currentState: 'DIDIT_PENDING',
        claimedDob: dobYearsAgo(18),
        verifiedDob: dobYearsAgo(15),
        diditDecision: 'approved',
      }),
    ).toBe('BLOCKED_UNDERAGE');
  });

  it('keeps SUSPENDED as terminal', () => {
    expect(
      resolve({
        currentState: 'SUSPENDED',
        claimedDob: dobYearsAgo(30),
        verifiedDob: dobYearsAgo(30),
        diditDecision: 'approved',
      }),
    ).toBe('SUSPENDED');
  });

  it('preserves ACTIVE when late in_review arrives with verifiedDob already set', () => {
    expect(
      resolve({
        currentState: 'ACTIVE',
        claimedDob: dobYearsAgo(25),
        verifiedDob: dobYearsAgo(25),
        diditDecision: 'in_review',
      }),
    ).toBe('ACTIVE');
  });
});

describe('stateToRoute', () => {
  it('routes incomplete / terminal states to the correct surfaces', () => {
    expect(stateToRoute('SIGNED_UP')).toBe('/onboarding/learner/verify');
    expect(stateToRoute('DIDIT_PENDING')).toBe('/onboarding/learner/verify');
    expect(stateToRoute('DIDIT_FAILED')).toBe('/onboarding/learner/verify');
    expect(stateToRoute('MANUAL_REVIEW')).toBe('/dashboard/student');
    expect(stateToRoute('HANDLEDARE_PENDING')).toBe('/onboarding/handledare');
    expect(stateToRoute('HANDLEDARE_EXPIRED')).toBe('/onboarding/handledare');
    expect(stateToRoute('ACTIVE')).toBe('/dashboard/student');
    expect(stateToRoute('BLOCKED_UNDERAGE')).toBe('/signup?blocked=underage');
    expect(stateToRoute('SUSPENDED')).toBe('/signup?blocked=suspended');
  });
});
