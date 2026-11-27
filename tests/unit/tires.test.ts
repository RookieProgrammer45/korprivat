import { describe, expect, it } from 'vitest';
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
});
