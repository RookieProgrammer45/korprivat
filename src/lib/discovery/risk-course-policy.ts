import type { TeachingPermissionFact } from '@/lib/acquisition/category-offering-policy';
import { offeringPublicationDecision } from '@/lib/acquisition/category-offering-policy';
import {
  canAcceptPendingRequest,
  type FoldedAuthorization,
} from '@/lib/orgs/school-authorization-policy';
import { evaluateBookingPolicy } from '@/lib/scheduling/booking-policy';

export const RISK_COURSE_TYPES = ['RISK_1', 'RISK_2'] as const;
export type RiskCourseType = (typeof RISK_COURSE_TYPES)[number];

export function isRiskCoursesOn(env: string | undefined = process.env.RISK_COURSES): boolean {
  return env === '1' || env === 'true';
}

export function isRiskCourseType(value: string): value is RiskCourseType {
  return (RISK_COURSE_TYPES as readonly string[]).includes(value);
}

export function remainingSeats(capacity: number, confirmedCount: number): number {
  return Math.max(0, capacity - confirmedCount);
}

/** Displayed remaining seats never constitute a hold or confirmation. */
export function seatDisplayIsHold(): false {
  return false;
}

export function isSessionDiscoverable(input: {
  publishedAt: string | null;
  approvedAt: string | null;
  source: string;
  startsAt: string;
  now?: string;
}): boolean {
  if (!input.publishedAt) return false;
  if (input.source === 'ACQ_DRAFT' && !input.approvedAt) return false;
  if (!input.approvedAt && input.source !== 'SCHOOL_PUBLISHED') return false;
  const now = Date.parse(input.now ?? new Date().toISOString());
  return Date.parse(input.startsAt) > now;
}

export function riskCoursePublishDecision(input: {
  courseType: string;
  licenceCategory: string;
  permissions: TeachingPermissionFact[];
  listingLegalEntity: string;
  listingLocation: string;
  source: string;
  schoolApproved: boolean;
}): { allowed: boolean; code: string } {
  if (!isRiskCourseType(input.courseType)) return { allowed: false, code: 'unknown_course_type' };
  if (input.source === 'ACQ_DRAFT' && !input.schoolApproved) {
    return { allowed: false, code: 'school_approval_required' };
  }
  return offeringPublicationDecision({
    enforced: true,
    offeringCategory: input.licenceCategory,
    permissions: input.permissions,
    listingLegalEntity: input.listingLegalEntity,
    listingLocation: input.listingLocation,
  });
}

export function riskCourseRequestDecision(input: {
  discoverable: boolean;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
  expired: boolean;
  categoryAllowed: boolean;
  studentContactVerified: boolean;
  instant: boolean;
  hasE4: boolean;
}): { allowed: true; mode: 'request' | 'instant' } | { allowed: false; code: string } {
  if (input.expired) return { allowed: false, code: 'session_expired' };
  if (!input.discoverable) return { allowed: false, code: 'not_published' };
  if (input.folded.withdrawn.includes('request_to_book') && !input.instant) {
    return { allowed: false, code: 'not_authorized_by_school' };
  }
  if (input.enforcementOn && !input.folded.granted.includes('request_to_book') && !input.instant) {
    return { allowed: false, code: 'not_authorized_by_school' };
  }
  const policy = evaluateBookingPolicy({
    action: input.instant ? 'instant_create' : 'request_submission',
    categoryAllowed: input.categoryAllowed,
    studentContactVerified: input.studentContactVerified,
    nativeSlotId: input.instant && input.hasE4 ? 'e4' : null,
  });
  if (!policy.ok) return { allowed: false, code: policy.component };
  if (input.instant && !input.hasE4) return { allowed: false, code: 'E4' };
  return { allowed: true, mode: input.instant && input.hasE4 ? 'instant' : 'request' };
}

export function riskCourseAcceptDecision(input: {
  bookingMode: string | null;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
  expired: boolean;
}): { allowed: boolean; code?: string } {
  if (input.expired) return { allowed: false, code: 'session_expired' };
  if (
    !canAcceptPendingRequest({
      bookingMode: input.bookingMode,
      folded: input.folded,
      enforcementOn: input.enforcementOn,
    })
  ) {
    return { allowed: false, code: 'not_authorized_by_school' };
  }
  return { allowed: true };
}

export function consumesSeat(input: { status: string; commitmentRoute: string | null }): boolean {
  if (input.status !== 'confirmed') return false;
  return input.commitmentRoute === 'native' || input.commitmentRoute === 'allocation';
}

export function municipalitySlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
