import { describe, expect, it } from 'vitest';
import {
  generatedCatalogueCities,
  indexableLocationPaths,
  isIndexableLocation,
  MIN_SCHOOLS_FOR_INDEXED_CITY,
  schoolsForLocation,
} from '@/lib/seo/catalogue-locations';
import { locationPath, NORDIC_LOCATIONS } from '@/lib/seo/nordic-locations';

describe('location indexing', () => {
  it('keeps hand-written Swedish hubs indexable', () => {
    for (const location of NORDIC_LOCATIONS.filter((l) => l.country === 'se')) {
      expect(isIndexableLocation(location)).toBe(true);
    }
  });

  it('drops thin hand-written hubs outside Sweden', () => {
    const thin = NORDIC_LOCATIONS.filter(
      (l) => l.country !== 'se' && l.kind === 'city' && schoolsForLocation(l).length < 3,
    );
    expect(thin.length).toBeGreaterThan(0);
    for (const location of thin) expect(isIndexableLocation(location)).toBe(false);
  });

  it('only indexes generated city pages with enough schools', () => {
    const sitemap = new Set(indexableLocationPaths());
    for (const city of generatedCatalogueCities()) {
      const enough = schoolsForLocation(city).length >= MIN_SCHOOLS_FOR_INDEXED_CITY;
      expect(isIndexableLocation(city)).toBe(enough);
      expect(sitemap.has(locationPath(city))).toBe(enough);
    }
  });
});
