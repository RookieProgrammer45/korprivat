import { describe, expect, it } from 'vitest';
import {
  compareInspectionPrice,
  inspectionCountries,
  inspectionFiltersFromSearch,
  listInspections,
  publishedInspections,
} from '@/lib/discovery/inspections';
import en from '../../messages/en.json';

describe('published inspection prices', () => {
  it('keeps only a price the station or the authority published', () => {
    const rows = publishedInspections();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.sourceUrl.startsWith('https://')).toBe(true);
      expect(row.amount).toBeGreaterThan(0);
      expect(row.currency).toMatch(/^[A-Z]{3}$/);
      expect(row.country).toMatch(/^[A-Z]{2}$/);
      expect(['fixed', 'from', 'maximum']).toContain(row.priceKind);
      for (const note of row.notes) {
        expect(en.inspectionPage.notes[note]).toEqual(expect.any(String));
      }
    }
    expect(inspectionCountries()).toEqual(['DE', 'DK', 'ES', 'GB', 'NO', 'SE']);
    expect(
      rows.some(
        (row) =>
          row.provider === 'Bilprovningen' &&
          row.vehicle === 'car' &&
          row.inspection === 'periodic',
      ),
    ).toBe(false);
  });

  it('sorts by currency rank before the amount', () => {
    const rows = listInspections(inspectionFiltersFromSearch({}));
    const currencies = rows.map((row) => row.currency);
    expect(currencies.indexOf('DKK')).toBeLessThan(currencies.indexOf('EUR'));
    expect(currencies.indexOf('EUR')).toBeLessThan(currencies.indexOf('GBP'));
    const spain = rows.find((row) => row.id === 'es-eivissa-car');
    const hillerod = rows.find((row) => row.id === 'dk-hilleroed-car');
    expect(spain && hillerod && compareInspectionPrice(hillerod, spain)).toBeLessThan(0);
  });

  it('keeps a statutory maximum distinct from a station fee', () => {
    const mot = listInspections(inspectionFiltersFromSearch({ country: 'GB', vehicle: 'car' }));
    expect(mot).toHaveLength(1);
    expect(mot[0]?.priceKind).toBe('maximum');
    expect(mot[0]?.amount).toBe(54.85);
    expect(mot[0]?.currency).toBe('GBP');
  });
});
