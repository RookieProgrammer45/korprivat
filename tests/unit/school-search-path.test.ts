import { describe, expect, it } from 'vitest';
import { SEARCH_CITIES, schoolSearchPath } from '@/lib/seo/school-search-path';

describe('schoolSearchPath', () => {
  it('opens the Sweden hub when no city is chosen', () => {
    expect(schoolSearchPath('')).toBe('/locations/se');
    expect(schoolSearchPath('  ')).toBe('/locations/se');
  });

  it('opens the public city hub for a known search city', () => {
    expect(schoolSearchPath('Stockholm')).toBe('/locations/se/stockholm');
    expect(schoolSearchPath('Göteborg')).toBe('/locations/se/goteborg');
    expect(schoolSearchPath('Gold Coast')).toBe('/locations/au/gold-coast');
  });

  it('never sends visitors to the login-walled instructor catalogue', () => {
    expect(schoolSearchPath('Stockholm')).not.toContain('/instructors');
    expect(SEARCH_CITIES.every((city) => city.href.startsWith('/locations/'))).toBe(true);
  });
});
