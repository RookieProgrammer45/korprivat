import { describe, expect, it } from 'vitest';
import {
  canTransition,
  checkoutAllowedByPolicy,
  draftPolicyFromLegacyTier,
  evaluateBookingPolicy,
  mapPaymentStatusToCanonical,
  previousBusinessDayCutoff,
  reconcileCapturedPayment,
  resolveReservationAcknowledgement,
  slotClaimOutcome,
} from '@/lib/scheduling/booking-policy';

describe('booking policy service', () => {
  it('SC-16 accepts manually without E4 and records the commitment route', () => {
    const decision = evaluateBookingPolicy({
      action: 'manual_accept',
      categoryAllowed: true,
      studentContactVerified: true,
      licenceStatus: 'VERIFIED',
      instructorAffiliated: true,
      nativeSlotId: null,
      commitmentRoute: 'external_manual',
    });
    expect(decision).toEqual({ ok: true, commitmentRoute: 'external_manual' });
  });

  it('requires E4 for instant create and not for request submission', () => {
    expect(
      evaluateBookingPolicy({
        action: 'instant_create',
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
        nativeSlotId: null,
      }),
    ).toEqual({ ok: false, component: 'E4' });
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
        nativeSlotId: null,
      }).ok,
    ).toBe(true);
  });

  it('fails closed when required E0–E3 facts are missing', () => {
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        offeringInScope: true,
        offeringActive: null,
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
      }),
    ).toEqual({ ok: false, component: 'E0' });
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        categoryAllowed: true,
        studentContactVerified: true,
        instructorAffiliated: true,
      }),
    ).toEqual({ ok: false, component: 'E1' });
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
      }),
    ).toEqual({ ok: false, component: 'E2' });
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        categoryAllowed: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
      }),
    ).toEqual({ ok: false, component: 'E3' });
  });

  it('blocks an inactive offering at E0 and an unverified licence at E1', () => {
    expect(
      evaluateBookingPolicy({
        action: 'request_submission',
        offeringInScope: true,
        offeringActive: false,
        categoryAllowed: true,
        studentContactVerified: true,
        licenceStatus: 'VERIFIED',
        instructorAffiliated: true,
      }),
    ).toEqual({ ok: false, component: 'E0' });
    expect(
      evaluateBookingPolicy({
        action: 'instant_create',
        categoryAllowed: true,
        licenceStatus: 'EXPIRED',
        studentContactVerified: true,
        instructorAffiliated: true,
        nativeSlotId: 'slot-1',
      }),
    ).toEqual({ ok: false, component: 'E1' });
  });

  it('SC-5 keeps an acknowledged reservation unconfirmed until authoritative state', () => {
    expect(resolveReservationAcknowledgement({ authoritative: 'unknown' })).toEqual({
      state: 'unresolved',
      openOpsTask: true,
      inventoryFree: false,
    });
    expect(resolveReservationAcknowledgement({ authoritative: 'confirmed' }).state).toBe(
      'confirmed',
    );
  });

  it('SC-6 claims a slot only when exactly one row updates', () => {
    expect(slotClaimOutcome(1)).toBe('claimed');
    expect(slotClaimOutcome(0)).toBe('conflict');
  });

  it('SC-10 places a Monday 10:00 cutoff on the previous Friday at 13:00', () => {
    const deadline = previousBusinessDayCutoff({
      lessonAt: new Date('2026-11-02T09:00:00.000Z'),
      timeZone: 'Europe/Stockholm',
      cutoffHour: 13,
      cutoffMinute: 0,
      businessDays: [1, 2, 3, 4, 5],
    });
    expect(deadline.toISOString()).toBe('2026-10-30T12:00:00.000Z');
  });

  it('SC-15 leaves an expired booking expired and offers only void/refund or a new booking', () => {
    expect(reconcileCapturedPayment('expired')).toEqual({
      action: 'late_captured',
      nextState: 'expired',
      opsActions: ['void_refund', 'new_booking'],
      autoConfirm: false,
    });
    expect(reconcileCapturedPayment('pending')).toEqual({ action: 'apply_capture' });
  });

  it('SC-18 imports legacy tiers as draft and never approved', () => {
    expect(draftPolicyFromLegacyTier('flexible')).toMatchObject({
      state: 'draft',
      approvedAt: null,
      source: 'legacy_tier',
      active: false,
    });
    expect(checkoutAllowedByPolicy({ enforced: false, hasActiveApprovedPolicy: false })).toBe(true);
    expect(checkoutAllowedByPolicy({ enforced: true, hasActiveApprovedPolicy: false })).toBe(false);
    expect(checkoutAllowedByPolicy({ enforced: true, hasActiveApprovedPolicy: true })).toBe(true);
  });

  it('rejects cancelled to no_show and keeps expired terminal', () => {
    expect(canTransition('cancelled', 'no_show')).toBe(false);
    expect(canTransition('expired', 'confirmed')).toBe(false);
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition(null, 'pending')).toBe(true);
    expect(mapPaymentStatusToCanonical('released')).toBe('completed');
    expect(mapPaymentStatusToCanonical('awaiting_approval')).toBe('pending');
    expect(mapPaymentStatusToCanonical('held_escrow')).toBe('confirmed');
  });
});
