import { describe, expect, it } from 'vitest';
import {
  NORDIC_COUNTRIES,
  NORDIC_LOCATIONS,
  allLocationSitemapPaths,
  getLocation,
  listCitiesInRegion,
  listLocationsForCountry,
  locationPath,
} from '@/lib/seo/nordic-locations';

describe('nordic-locations registry', () => {
  it('covers all five Nordic countries with unique country/slug keys', () => {
    expect(NORDIC_COUNTRIES).toEqual(['se', 'no', 'dk', 'fi', 'is']);
    const keys = NORDIC_LOCATIONS.map((l) => `${l.country}/${l.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('keeps marketplaceLive only for Sweden locations', () => {
    for (const loc of NORDIC_LOCATIONS) {
      if (loc.country === 'se') {
        expect(loc.marketplaceLive).toBe(true);
      } else {
        expect(loc.marketplaceLive).toBe(false);
        expect(loc.filterCity).toBeUndefined();
      }
    }
  });

  it('resolves featured SE hubs and region children', () => {
    expect(getLocation('se', 'stockholm')?.kind).toBe('city');
    expect(locationPath({ country: 'se', slug: 'malmo' })).toBe('/locations/se/malmo');
    expect(listCitiesInRegion('se', 'skane').map((c) => c.slug)).toContain('lund');
    expect(listLocationsForCountry('no').some((l) => l.slug === 'oslo')).toBe(true);
  });

  it('builds sitemap paths for index, countries, and every hub', () => {
    const paths = allLocationSitemapPaths();
    expect(paths[0]).toBe('/locations');
    for (const code of NORDIC_COUNTRIES) {
      expect(paths).toContain(`/locations/${code}`);
    }
    expect(paths).toContain('/locations/se/stockholm');
    expect(paths).toContain('/locations/dk/copenhagen');
    expect(paths.length).toBe(1 + NORDIC_COUNTRIES.length + NORDIC_LOCATIONS.length);
  });
});
