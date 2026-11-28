import { describe, expect, it } from 'vitest';
import { nearestTireCity, TIRE_PLACES } from '@/lib/discovery/tire-place';
import {
  compareTirePrice,
  listTires,
  publishedTires,
  tireCountries,
  tireFiltersFromSearch,
} from '@/lib/discovery/tires';
import { tireSearchPath } from '@/lib/seo/tire-search-path';
import en from '../../messages/en.json';

describe('published tire prices', () => {
  it('keeps only a price the workshop page published', () => {
    const rows = publishedTires();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.sourceUrl.startsWith('https://')).toBe(true);
      expect(row.amount).toBeGreaterThan(0);
      expect(row.currency).toMatch(/^[A-Z]{3}$/);
      expect(row.country).toMatch(/^[A-Z]{2}$/);
      expect(['fixed', 'from', 'maximum']).toContain(row.priceKind);
      for (const note of row.notes) {
        expect(en.tirePage.notes[note]).toEqual(expect.any(String));
      }
    }
    expect(tireCountries()).toEqual(['FI', 'GB', 'NL', 'NO', 'SE']);
  });

  it('sorts by currency rank before the amount', () => {
    const rows = listTires(tireFiltersFromSearch({}));
    const currencies = rows.map((row) => row.currency);
    expect(currencies.indexOf('SEK')).toBeLessThan(currencies.indexOf('NOK'));
    expect(currencies.indexOf('NOK')).toBeLessThan(currencies.indexOf('EUR'));
    const finland = rows.find((row) => row.id === 'fi-vianor-car-change');
    expect(rows.some((row) => row.id === 'se-mekonomen-car-change' && row.amount === 249)).toBe(
      true,
    );
    expect(rows.some((row) => row.id === 'se-bilia-car-change' && row.amount === 495)).toBe(true);
    expect(rows.some((row) => row.id === 'se-holmgrens-car-change' && row.amount === 475)).toBe(
      true,
    );
    expect(rows.some((row) => row.id === 'se-citydack-car-change' && row.amount === 345)).toBe(
      true,
    );
    expect(rows.some((row) => row.id === 'se-thansen-car-change' && row.amount === 359.8)).toBe(
      true,
    );
    const sweden = rows.find((row) => row.id === 'se-vianor-car-change');
    expect(finland && sweden && compareTirePrice(sweden, finland)).toBeLessThan(0);
  });

  it('does not show a mobile visit as a workshop wheel change', () => {
    const change = listTires(tireFiltersFromSearch({ country: 'GB' }));
    expect(change).toHaveLength(0);
    const mobile = listTires(tireFiltersFromSearch({ country: 'GB', service: 'mobile' }));
    expect(mobile).toHaveLength(1);
    expect(mobile[0]?.amount).toBe(30);
    expect(mobile[0]?.priceKind).toBe('maximum');
    const van = listTires(
      tireFiltersFromSearch({ country: 'GB', vehicle: 'van', service: 'mobile' }),
    );
    expect(van.map((row) => row.vehicle)).toEqual(['van']);
    expect(tireSearchPath(tireFiltersFromSearch({}))).toBe('/dack');
    expect(tireSearchPath(tireFiltersFromSearch({ service: 'hotel' }))).toBe('/dack?service=hotel');
  });

  it('keeps a country-wide price in that country and a named workshop in its cities', () => {
    const goteborg = listTires(tireFiltersFromSearch({ place: 'Göteborg' }));
    expect(goteborg.some((row) => row.id === 'se-citydack-car-change')).toBe(true);
    expect(goteborg.some((row) => row.id === 'se-mekonomen-car-change')).toBe(true);
    expect(goteborg.some((row) => row.country !== 'SE')).toBe(false);
    const stockholm = listTires(tireFiltersFromSearch({ place: 'Stockholm' }));
    expect(stockholm.some((row) => row.id === 'se-citydack-car-change')).toBe(false);
    expect(stockholm.some((row) => row.id === 'se-brandt-car-change')).toBe(false);
    expect(stockholm.some((row) => row.id === 'se-holmgrens-car-change')).toBe(false);
    expect(stockholm.some((row) => row.id === 'se-mekonomen-car-change')).toBe(true);
    expect(stockholm.some((row) => row.id === 'se-meca-car-change' && row.amount === 250)).toBe(
      true,
    );
    expect(stockholm.some((row) => row.id === 'se-mechanum-car-change' && row.amount === 499)).toBe(
      true,
    );
    const oslo = listTires(tireFiltersFromSearch({ place: 'Oslo' }));
    expect(oslo.some((row) => row.id === 'no-bos-car-change' && row.amount === 699)).toBe(true);
    expect(oslo.some((row) => row.id === 'no-autoria-car-change')).toBe(false);
    expect(oslo.every((row) => row.country === 'NO')).toBe(true);
    const path = tireSearchPath(tireFiltersFromSearch({ place: 'Göteborg', country: 'SE' }));
    const params = new URLSearchParams(path.slice(path.indexOf('?') + 1));
    expect(params.get('place')).toBe('Göteborg');
    expect(params.get('country')).toBe('SE');
    expect(nearestTireCity(59.3293, 18.0686)).toBe('Stockholm');
    expect(nearestTireCity(55.47, 13.02)).toBe('Malmö');
    expect(nearestTireCity(0, 0)).toBeNull();
    expect(TIRE_PLACES.some((city) => city.value === 'Helsinki' && city.country === 'FI')).toBe(
      true,
    );
  });
});
