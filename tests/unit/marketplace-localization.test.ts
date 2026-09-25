import { describe, expect, it } from 'vitest';
import {
  normalizeMarketplaceLocale,
  providerSlotDateParts,
  recommendationReason,
} from '@/lib/business/marketplace-localization';

describe('marketplace localization helpers', () => {
  it('normalizes unknown locales to the Swedish default', () => {
    expect(normalizeMarketplaceLocale('sv')).toBe('sv');
    expect(normalizeMarketplaceLocale('en')).toBe('en');
    expect(normalizeMarketplaceLocale('de')).toBe('sv');
  });

  it('keeps deterministic recommendation reasons in the active language', () => {
    const input = { city: 'Stockholm', learnerCity: 'Stockholm', bookedHours: 12 };

    expect(recommendationReason({ ...input, locale: 'sv' })).toBe(
      'Stockholm matchar ditt val — 12 h övningskörning bokad.',
    );
    expect(recommendationReason({ ...input, locale: 'en' })).toBe(
      'Stockholm matches your selection — 12h of practice booked.',
    );
  });

  it('formats preview slots in the provider timezone across a UTC date boundary', () => {
    const parts = providerSlotDateParts(
      '2026-01-05T23:30:00.000Z',
      'sv',
      new Date('2026-01-05T22:30:00.000Z'),
    );

    expect(parts).toMatchObject({
      day: '6',
      isWithinNextWeek: true,
      time: '00:30',
    });
    expect(parts?.weekday).toMatch(/tis/i);
  });
});
