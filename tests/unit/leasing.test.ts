import { describe, expect, it } from 'vitest';
import {
  compareLeasePrice,
  leaseCountries,
  leaseFiltersFromSearch,
  listLeases,
  publishedLeases,
} from '@/lib/discovery/leasing';
import { leasingSearchPath } from '@/lib/seo/leasing-search-path';
import en from '../../messages/en.json';

describe('published lease prices', () => {
  it('keeps a row only when the page named the model and the monthly amount', () => {
    const rows = publishedLeases();
    expect(rows).toHaveLength(53);
    for (const row of rows) {
      expect(row.sourceUrl.startsWith('https://')).toBe(true);
      expect(row.model.length).toBeGreaterThan(0);
      expect(row.amount).toBeGreaterThan(0);
      expect(row.currency).toMatch(/^[A-Z]{3}$/);
      expect(row.country).toMatch(/^[A-Z]{2}$/);
      expect(['fixed', 'from', 'maximum']).toContain(row.priceKind);
      for (const note of row.notes) {
        expect(en.leasingPage.notes[note]).toEqual(expect.any(String));
      }
    }
    expect(leaseCountries()).toEqual(['FI', 'NL', 'NO', 'SE']);
  });

  it('sorts by currency rank before the monthly amount', () => {
    const rows = listLeases(leaseFiltersFromSearch({}));
    const currencies = rows.map((row) => row.currency);
    expect(currencies.indexOf('SEK')).toBeLessThan(currencies.indexOf('NOK'));
    expect(currencies.indexOf('NOK')).toBeLessThan(currencies.indexOf('EUR'));
    const sweden = rows.find((row) => row.id === 'se-vw-polo-life-swe');
    const finland = rows.find((row) => row.id === 'fi-vw-id-polo-trend');
    expect(sweden && finland && compareLeasePrice(sweden, finland)).toBeLessThan(0);
  });

  it('keeps the contract facts that the page stated for that country', () => {
    const sweden = listLeases(leaseFiltersFromSearch({ country: 'SE' }));
    const polo = sweden.find((row) => row.id === 'se-vw-polo-life-swe');
    expect(polo?.amount).toBe(2995);
    expect(polo?.priceKind).toBe('from');
    expect(polo?.termMonths).toBeNull();
    const ev2 = sweden.find((row) => row.id === 'se-kia-ev2');
    expect(ev2?.amount).toBe(3495);
    expect(ev2?.termMonths).toBe(36);
    expect(ev2?.notes).toContain('variableFee');
    const netherlands = listLeases(leaseFiltersFromSearch({ country: 'NL' }));
    expect(netherlands.every((row) => row.place === 'Utrecht')).toBe(true);
    expect(netherlands.every((row) => row.mileageScope === 'year' && row.mileageKm === 5000)).toBe(
      true,
    );
    expect(netherlands.find((row) => row.id === 'nl-vw-id-cross')?.amount).toBe(439);
    expect(netherlands.find((row) => row.id === 'nl-vw-id4')?.amount).toBe(569);
    const finland = listLeases(leaseFiltersFromSearch({ country: 'FI' }));
    expect(finland.find((row) => row.id === 'fi-vw-id-polo-trend')).toMatchObject({
      amount: 359,
      termMonths: 48,
      mileageKm: 40000,
      mileageScope: 'term',
    });
    expect(finland.find((row) => row.id === 'fi-vw-t-roc-comfort')?.amount).toBe(449);
    const norway = listLeases(leaseFiltersFromSearch({ country: 'NO' }));
    expect(norway).toHaveLength(1);
    expect(norway[0]).toMatchObject({
      amount: 5490,
      priceKind: 'fixed',
      place: 'Oslo',
      mileageKm: 45000,
      mileageScope: 'term',
    });
    expect(leasingSearchPath(leaseFiltersFromSearch({}))).toBe('/privatleasing');
    expect(leasingSearchPath(leaseFiltersFromSearch({ country: 'NL' }))).toBe(
      '/privatleasing?country=NL',
    );
  });
});
