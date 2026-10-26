// Canonical booking policy (specs/09 §6.1–§6.3). Pure: callers pass stored
// facts. Missing verification is not invented. paymentStatus is not written here.

export type PolicyComponent = 'E0' | 'E1' | 'E2' | 'E3' | 'E4';
export type BookingPolicyAction =
  | 'request_submission'
  | 'instant_create'
  | 'manual_accept'
  | 'confirm';

export type CommitmentRoute = 'native' | 'external_manual';

export type PolicyFacts = {
  action: BookingPolicyAction;
  /** When true, E0 requires offeringActive === true. Missing required facts fail closed. */
  offeringInScope?: boolean;
  offeringActive?: boolean | null;
  categoryAllowed?: boolean | null;
  licenceStatus?: 'VERIFIED' | 'EXPIRED' | 'PENDING' | 'REVOKED' | null;
  studentContactVerified?: boolean | null;
  instructorAffiliated?: boolean | null;
  nativeSlotId?: string | null;
  commitmentRoute?: CommitmentRoute | null;
};

export type PolicyDecision =
  | { ok: true; commitmentRoute: CommitmentRoute | null }
  | { ok: false; component: PolicyComponent };

const REQUIRES_E4 = new Set<BookingPolicyAction>(['instant_create', 'confirm']);

export function evaluateBookingPolicy(facts: PolicyFacts): PolicyDecision {
  if (facts.offeringInScope && facts.offeringActive !== true) {
    return { ok: false, component: 'E0' };
  }
  if (facts.categoryAllowed !== true) return { ok: false, component: 'E1' };
  if (facts.licenceStatus !== 'VERIFIED') return { ok: false, component: 'E1' };
  if (facts.instructorAffiliated !== true) return { ok: false, component: 'E2' };
  if (facts.studentContactVerified !== true) return { ok: false, component: 'E3' };
  if (REQUIRES_E4.has(facts.action) && !facts.nativeSlotId) {
    return { ok: false, component: 'E4' };
  }
  if (facts.action === 'manual_accept') {
    return { ok: true, commitmentRoute: facts.commitmentRoute ?? null };
  }
  return {
    ok: true,
    commitmentRoute: facts.action === 'instant_create' ? 'native' : null,
  };
}

export type CanonicalBookingState =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'no_show';

const CANONICAL_EDGES: Record<CanonicalBookingState, CanonicalBookingState[]> = {
  pending: ['confirmed', 'expired', 'cancelled'],
  confirmed: ['in_progress', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  expired: [],
  no_show: [],
};

export function canTransition(
  from: CanonicalBookingState | null,
  to: CanonicalBookingState,
): boolean {
  if (from == null) return to === 'pending';
  return CANONICAL_EDGES[from].includes(to);
}

export function mapPaymentStatusToCanonical(
  paymentStatus: string | null | undefined,
): CanonicalBookingState {
  switch (paymentStatus) {
    case 'awaiting_buyer_confirmation':
    case 'release_ready':
      return 'in_progress';
    case 'released':
    case 'payout_pending':
      return 'completed';
    case 'cancelled_early':
    case 'cancelled_late':
    case 'cancelled_full_refund':
    case 'cancelled_partial':
    case 'refunded':
    case 'declined':
      return 'cancelled';
    case 'held_escrow':
    case 'paid':
    case 'disputed':
    case 'payout_failed':
      return 'confirmed';
    default:
      return 'pending';
  }
}

/** A 202 acknowledgement is not confirmation (SC-5). */
export function resolveReservationAcknowledgement(input: {
  authoritative: 'confirmed' | 'not_confirmed' | 'unknown';
}): {
  state: 'confirmed' | 'pending' | 'unresolved';
  openOpsTask: boolean;
  inventoryFree: boolean;
} {
  if (input.authoritative === 'confirmed') {
    return { state: 'confirmed', openOpsTask: false, inventoryFree: false };
  }
  if (input.authoritative === 'not_confirmed') {
    return { state: 'pending', openOpsTask: false, inventoryFree: true };
  }
  return { state: 'unresolved', openOpsTask: true, inventoryFree: false };
}

export function slotClaimOutcome(updatedCount: number): 'claimed' | 'conflict' {
  return updatedCount === 1 ? 'claimed' : 'conflict';
}

export function reconcileCapturedPayment(canonicalState: CanonicalBookingState):
  | { action: 'apply_capture' }
  | {
      action: 'late_captured';
      nextState: 'expired';
      opsActions: ['void_refund', 'new_booking'];
      autoConfirm: false;
    } {
  if (canonicalState === 'expired') {
    return {
      action: 'late_captured',
      nextState: 'expired',
      opsActions: ['void_refund', 'new_booking'],
      autoConfirm: false,
    };
  }
  return { action: 'apply_capture' };
}

export type LegacyCancellationTier = 'flexible' | 'moderate' | 'strict';

export function draftPolicyFromLegacyTier(tier: LegacyCancellationTier): {
  tier: LegacyCancellationTier;
  state: 'draft';
  approvedAt: null;
  source: 'legacy_tier';
  deadlineType: 'elapsed_hours_before';
  active: false;
} {
  return {
    tier,
    state: 'draft',
    approvedAt: null,
    source: 'legacy_tier',
    deadlineType: 'elapsed_hours_before',
    active: false,
  };
}

export function isCancellationPolicyEnforced(
  env: string | undefined = process.env.CANCELLATION_POLICY_ENFORCE,
): boolean {
  return env === '1' || env === 'true';
}

export function checkoutAllowedByPolicy(input: {
  enforced: boolean;
  hasActiveApprovedPolicy: boolean;
}): boolean {
  if (!input.enforced) return true;
  return input.hasActiveApprovedPolicy;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekday: number;
} {
  const bag: Record<string, string> = {};
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)) {
    bag[part.type] = part.value;
  }
  const weekdayName = bag.weekday;
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    weekday: weekdayName == null ? 0 : (WEEKDAY_INDEX[weekdayName] ?? 0),
  };
}

function shiftCalendarDay(year: number, month: number, day: number, delta: number) {
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + delta);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function weekdayOfCalendarDay(year: number, month: number, day: number): number {
  const utc = new Date(Date.UTC(year, month - 1, day));
  const js = utc.getUTCDay();
  return js === 0 ? 7 : js;
}

function instantInZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const bag: Record<string, string> = {};
    for (const part of new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(utc))) {
      bag[part.type] = part.value;
    }
    const hourPart = bag.hour === '24' ? 0 : Number(bag.hour);
    const asUtc = Date.UTC(
      Number(bag.year),
      Number(bag.month) - 1,
      Number(bag.day),
      hourPart,
      Number(bag.minute),
      Number(bag.second),
    );
    const offset = asUtc - utc;
    utc = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return new Date(utc);
}

/** SC-10: cancel-by local clock on the previous business day. */
export function previousBusinessDayCutoff(input: {
  lessonAt: Date;
  timeZone: string;
  cutoffHour: number;
  cutoffMinute: number;
  businessDays: number[];
}): Date {
  const lesson = zonedParts(input.lessonAt, input.timeZone);
  let cursor = shiftCalendarDay(lesson.year, lesson.month, lesson.day, -1);
  for (let guard = 0; guard < 14; guard += 1) {
    if (input.businessDays.includes(weekdayOfCalendarDay(cursor.year, cursor.month, cursor.day))) {
      return instantInZone(
        cursor.year,
        cursor.month,
        cursor.day,
        input.cutoffHour,
        input.cutoffMinute,
        input.timeZone,
      );
    }
    cursor = shiftCalendarDay(cursor.year, cursor.month, cursor.day, -1);
  }
  throw new Error('no business day in window');
}
