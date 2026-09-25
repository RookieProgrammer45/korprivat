import { describe, expect, it } from 'vitest';
import { bookingCapabilities, canTransition } from '@/lib/business/booking-transitions';
import {
  formatProviderDate,
  localDateTimeToUtcIso,
  providerTimezoneForCity,
} from '@/lib/business/provider-timezone';
import { AvailabilitySlotCreate } from '@/lib/contracts/availability';

describe('provider operations rules', () => {
  it('keeps Swedish wall-clock times stable across daylight saving time', () => {
    expect(localDateTimeToUtcIso('2030-01-15T10:00', 'Europe/Stockholm')).toBe(
      '2030-01-15T09:00:00.000Z',
    );
    expect(localDateTimeToUtcIso('2030-07-15T10:00', 'Europe/Stockholm')).toBe(
      '2030-07-15T08:00:00.000Z',
    );
    expect(formatProviderDate('2030-07-15T08:00:00.000Z', 'sv', 'Europe/Stockholm')).toContain(
      '10:00',
    );
  });

  it('uses the Swedish timezone for known cities and an explicit fallback elsewhere', () => {
    expect(providerTimezoneForCity('Malmö')).toBe('Europe/Stockholm');
    expect(providerTimezoneForCity('Unknown city')).toBe('UTC');
  });

  it('rejects malformed and duration-inconsistent availability input', () => {
    expect(
      AvailabilitySlotCreate.safeParse({
        mode: 'single',
        startsAt: '2030-01-15T09:00:00.000Z',
        endsAt: '2030-01-15T10:00:00.000Z',
        durationMinutes: 45,
      }).success,
    ).toBe(false);
    expect(
      AvailabilitySlotCreate.safeParse({
        mode: 'weekly',
        weekdays: [1],
        startDate: '2030-02-30',
        timeOfDay: '10:00',
        weeksAhead: 2,
        durationMinutes: 60,
      }).success,
    ).toBe(false);
  });

  it('exposes provider-only request capabilities and transition guards', () => {
    expect(bookingCapabilities('awaiting_approval', 'provider', 'HANDLEDARE')).toMatchObject({
      canAccept: true,
      canDecline: true,
    });
    expect(bookingCapabilities('awaiting_approval', 'learner')).toMatchObject({
      canAccept: false,
      canDecline: false,
    });
    expect(canTransition('awaiting_approval', 'pending', 'provider')).toBe(true);
    expect(canTransition('awaiting_approval', 'pending', 'learner')).toBe(false);
  });
});
