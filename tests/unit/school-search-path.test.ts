import { describe, expect, it } from 'vitest';
import { heroCategoryMatches, SEARCH_CITIES, schoolSearchPath } from '@/lib/seo/school-search-path';

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

  it('keeps motorcycle and trailer choices on the result', () => {
    expect(schoolSearchPath('Göteborg', 'A')).toBe('/locations/se/goteborg?category=A');
    expect(schoolSearchPath('', 'BE')).toBe('/?category=BE');
    expect(schoolSearchPath('Stockholm', 'B')).toBe('/locations/se/stockholm');
    expect(schoolSearchPath('Stockholm', 'C')).toBe('/locations/se/stockholm');
  });

  it('matches only the chosen licence when the search is not car', () => {
    expect(heroCategoryMatches(['B'], 'B')).toBe(true);
    expect(heroCategoryMatches(['B'], 'A')).toBe(false);
    expect(heroCategoryMatches(['A', 'B'], 'A')).toBe(true);
    expect(heroCategoryMatches(['BE'], 'nope')).toBe(true);
  });
});
