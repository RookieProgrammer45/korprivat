import { describe, expect, it } from 'vitest';
import { intlLocale } from '@/lib/intl-locale';

describe('intlLocale', () => {
  it('formats each catalogue language in that language', () => {
    expect(intlLocale('sv')).toBe('sv-SE');
    expect(intlLocale('en')).toBe('en-GB');
    expect(intlLocale('da')).toBe('da-DK');
    expect(intlLocale('nb')).toBe('nb-NO');
    expect(intlLocale('de')).toBe('de-DE');
    expect(
      new Intl.DateTimeFormat(intlLocale('da'), { month: 'short' }).format(
        new Date('2026-10-26T12:00:00Z'),
      ),
    ).not.toBe('Oct');
  });
});
