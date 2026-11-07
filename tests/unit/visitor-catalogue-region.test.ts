import { describe, expect, it } from 'vitest';
import { catalogueCountryCode, listCatalogueSchools } from '@/lib/discovery/nordic-catalogue';
import {
  homepageSchoolRegionScore,
  visitorCatalogueRegionFromHeaders,
} from '@/lib/discovery/visitor-catalogue-region';

describe('visitorCatalogueRegionFromHeaders', () => {
  it('maps Vercel geo headers to catalogue country and US state slug', () => {
    const region = visitorCatalogueRegionFromHeaders((name) => {
      if (name === 'x-vercel-ip-country') return 'US';
      if (name === 'x-vercel-ip-country-region') return 'CA';
      return null;
    });
    expect(region).toEqual({ countryCode: 'us', regionSlug: 'california' });
  });

  it('maps a Canadian visitor to Canada, not California', () => {
    const region = visitorCatalogueRegionFromHeaders((name) => {
      if (name === 'x-vercel-ip-country') return 'CA';
      if (name === 'x-vercel-ip-country-region') return 'ON';
      return null;
    });
    expect(region).toEqual({ countryCode: 'ca', regionSlug: 'ontario' });
  });

  it('maps a Brazilian visitor to the catalogue state slug', () => {
    const region = visitorCatalogueRegionFromHeaders((name) => {
      if (name === 'x-vercel-ip-country') return 'BR';
      if (name === 'x-vercel-ip-country-region') return 'SP';
      return null;
    });
    expect(region).toEqual({ countryCode: 'br', regionSlug: 'sao-paulo' });
  });

  it('defaults to Sweden when geo headers are missing', () => {
    expect(visitorCatalogueRegionFromHeaders(() => null)).toEqual({
      countryCode: 'se',
      regionSlug: null,
    });
  });
});

describe('homepageSchoolRegionScore', () => {
  it('ranks in-country listings above others', () => {
    const local = listCatalogueSchools().find((s) => catalogueCountryCode(s.id) === 'no');
    expect(local).toBeTruthy();
    if (!local) return;
    const match = { countryCode: 'no', regionSlug: null };
    const other = { countryCode: 'us', regionSlug: null };
    expect(homepageSchoolRegionScore(local.id, match)).toBe(10);
    expect(homepageSchoolRegionScore(local.id, other)).toBe(0);
  });
});
