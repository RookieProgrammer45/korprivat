import { describe, expect, it } from 'vitest';
import { emailFromPages } from '../../scripts/school-prices/email';

const page = (text: string, url = 'https://skola.se/') => ({ url, text });

describe('emailFromPages', () => {
  it('takes the one address on the site', () => {
    expect(emailFromPages([page('Mejla info@skola.se')])).toEqual({
      address: 'info@skola.se',
      sourceUrl: 'https://skola.se/',
    });
  });

  it('keeps a clearly dominant address', () => {
    expect(
      emailFromPages([
        page('info@skola.se info@skola.se'),
        page('info@skola.se kundtjanst@trafikverket.se'),
      ])?.address,
    ).toBe('info@skola.se');
  });

  it('skips two addresses of equal weight', () => {
    expect(emailFromPages([page('vaxjo@skola.se ljungby@skola.se')])).toBeNull();
  });
});
