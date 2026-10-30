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
  it('keeps hand-written hubs indexable', () => {
    for (const location of NORDIC_LOCATIONS) {
      expect(isIndexableLocation(location)).toBe(true);
    }
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
