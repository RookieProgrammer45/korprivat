import { describe, expect, it } from 'vitest';
import { listCatalogueSchools } from '@/lib/discovery/nordic-catalogue';
import {
  generatedCatalogueCities,
  indexableLocationPaths,
  locationForCatalogueSchool,
  locationsForCountry,
  resolveLocation,
  schoolsForLocation,
  websiteCountryDisagrees,
} from '@/lib/seo/catalogue-locations';
import { marketCopy } from '@/lib/seo/market-copy';
import { allLocationSitemapPaths } from '@/lib/seo/nordic-locations';
import { schoolPath } from '@/lib/seo/school-slugs';

describe('catalogue location pages', () => {
  it('keeps an existing hub and lists its schools', () => {
    const leonberg = resolveLocation('de', 'leonberg');
    expect(leonberg?.name).toBe('Leonberg');
    const schools = leonberg ? schoolsForLocation(leonberg) : [];
    expect(schools.some((school) => school.name === 'Richt')).toBe(true);
    expect(schools.some((school) => school.publishedPrices?.heavy?.categories.includes('C'))).toBe(
      true,
    );
    expect(
      locationsForCountry('de').filter((location) => location.name === 'Leonberg'),
    ).toHaveLength(1);
  });

  it('adds a city page for a catalogue city that had no hub', () => {
    const staticPaths = new Set(allLocationSitemapPaths());
    const generated = generatedCatalogueCities();
    expect(generated.length).toBeGreaterThan(100);
    expect(generated.every((location) => location.marketplaceLive === false)).toBe(true);
    expect(
      generated.every(
        (location) => !staticPaths.has(`/locations/${location.country}/${location.slug}`),
      ),
    ).toBe(true);
    const sample = generated.find((location) => location.country === 'de');
    expect(sample).toBeTruthy();
    if (!sample) return;
    expect(resolveLocation(sample.country, sample.slug)?.name).toBe(sample.name);
    expect(schoolsForLocation(sample).length).toBeGreaterThan(0);
    expect(indexableLocationPaths()).toContain(`/locations/${sample.country}/${sample.slug}`);
  });

  it('does not give a mismatched country domain its own city page', () => {
    expect(websiteCountryDisagrees('https://altaisauto.md/', 'ro')).toBe(true);
    expect(websiteCountryDisagrees('https://fahrschule-richt.de/', 'de')).toBe(false);
    expect(locationsForCountry('ro').some((location) => location.name === 'Chișinău')).toBe(false);
    expect(locationsForCountry('ro').some((location) => location.name === 'Бор')).toBe(false);
  });

  it('puts catalogue schools in the sitemap and on a local city page', () => {
    const galway = listCatalogueSchools().find((school) => school.id.startsWith('euie246274'));
    expect(galway?.city).toBe('Galway');
    if (!galway) return;
    expect(indexableLocationPaths()).toContain('/locations/ie/galway');
    const hub = locationForCatalogueSchool(galway.id);
    expect(hub?.country).toBe('ie');
    expect(schoolPath(galway)).toContain('/trafikskola/galway/');
  });
});

describe('market copy', () => {
  it('uses the local language for a German city and leaves Sweden to the site locale', () => {
    const german = marketCopy('de');
    expect(german?.cityHeading('Leonberg')).toBe('Fahrschulen in Leonberg');
    expect(german?.schemaLang).toBe('de-DE');
    expect(german?.schoolDescription('Richt', 'Leonberg')).toContain('nicht geprüft');
    expect(marketCopy('se')).toBeNull();
    expect(marketCopy('fr')?.cityHeading('Lyon')).toContain('Auto-écoles');
  });
});
