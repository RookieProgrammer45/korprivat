import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { availabilityTimezone } from '@/components/custom/dashboard/availability-timezone';
import { isInstructorPolicyDirty } from '@/components/custom/dashboard/instructor-policy-state';
import { paymentStatusDisplay } from '@/components/custom/dashboard/payment-status-display';
import { localDateTimeToUtcIso } from '@/lib/business/provider-timezone';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import { BookingPaymentStatusEnum } from '@/lib/contracts/bookings';

describe('dashboard state reliability regressions', () => {
  it('keeps instructor settings dirty when either independent setting differs from its original value', () => {
    expect(
      isInstructorPolicyDirty({
        selected: 'flexible',
        original: 'flexible',
        bookingMode: 'request',
        bookingModeOriginal: 'instant',
      }),
    ).toBe(true);
    expect(
      isInstructorPolicyDirty({
        selected: 'strict',
        original: 'flexible',
        bookingMode: 'instant',
        bookingModeOriginal: 'instant',
      }),
    ).toBe(true);
    expect(
      isInstructorPolicyDirty({
        selected: 'flexible',
        original: 'flexible',
        bookingMode: 'instant',
        bookingModeOriginal: 'instant',
      }),
    ).toBe(false);
  });

  it('uses owner timezone metadata for an empty availability list instead of a slot-derived default', () => {
    const emptyOwnedList = AvailabilitySlotList.parse({
      providerTimezone: 'UTC',
      items: [],
    });

    const timezone = availabilityTimezone(emptyOwnedList);
    expect(timezone).toBe('UTC');
    if (!timezone) throw new Error('Expected an owner timezone');
    expect(localDateTimeToUtcIso('2030-07-15T10:00', timezone)).toBe('2030-07-15T10:00:00.000Z');
  });

  it('maps every reachable payment enum value to an existing visible learner label', () => {
    const en = JSON.parse(readFileSync(join(process.cwd(), 'messages/en.json'), 'utf8')) as {
      dashboard: { student: { paymentStatus: Record<string, string> } };
    };

    for (const status of BookingPaymentStatusEnum.options) {
      const display = paymentStatusDisplay(status);
      const label = en.dashboard.student.paymentStatus[display.labelKey];
      expect(label).toEqual(expect.any(String));
      expect(label?.trim()).not.toBe('');
    }

    expect(paymentStatusDisplay('awaiting_buyer_confirmation').labelKey).toBe(
      'awaitingBuyerConfirmation',
    );
    expect(paymentStatusDisplay('release_ready').labelKey).toBe('releaseReady');
    expect(paymentStatusDisplay('disputed').labelKey).toBe('disputed');
    expect(paymentStatusDisplay('payout_pending').labelKey).toBe('releaseReady');
    expect(paymentStatusDisplay('payout_failed').labelKey).toBe('payoutFailed');
    expect(paymentStatusDisplay('future_status').labelKey).toBe('pending');
  });
});
