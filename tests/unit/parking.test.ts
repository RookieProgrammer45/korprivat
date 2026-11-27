import { describe, expect, it } from 'vitest';
import {
  listParking,
  parkingCities,
  parkingFiltersFromSearch,
  publishedParking,
} from '@/lib/discovery/parking';
import { parkingSearchPath } from '@/lib/seo/parking-search-path';
import en from '../../messages/en.json';

const notes = en.parkingPage.notes;

describe('published parking prices', () => {
  it('keeps an hour price only when the page named the place', () => {
    const rows = publishedParking();
    expect(rows.length).toBe(25);
    const currencies = new Set<string>();
    for (const row of rows) {
      expect(row.sourceUrl.startsWith('https://')).toBe(true);
      expect(row.amount).toBeGreaterThan(0);
      expect(row.unit).toBe('hour');
      expect(row.priceKind).toBe('fixed');
      expect(row.spot.length).toBeGreaterThan(0);
      expect(notes[row.notes[0] ?? 'signWins']).toBeTypeOf('string');
      for (const note of row.notes) expect(notes[note].length).toBeGreaterThan(0);
      currencies.add(row.currency);
    }
    expect([...currencies].sort()).toEqual(['DKK', 'EUR', 'NOK', 'SEK']);
    expect(
      rows
        .map((row) => row.country)
        .filter((country, index, all) => all.indexOf(country) === index),
    ).toEqual(['SE', 'NO', 'FI', 'DK']);
  });

  it('sorts a city by the hour and keeps currencies apart', () => {
    const stockholm = listParking(parkingFiltersFromSearch({ country: 'SE', city: 'stockholm' }));
    expect(stockholm.map((row) => row.amount)).toEqual([25, 30, 60, 95]);
    expect(stockholm.every((row) => row.city === 'stockholm')).toBe(true);
    const all = listParking(parkingFiltersFromSearch({}));
    const sek = all.filter((row) => row.currency === 'SEK').map((row) => row.amount);
    expect(sek).toEqual([...sek].sort((a, b) => a - b));
    expect(all.findIndex((row) => row.currency === 'NOK')).toBeGreaterThan(
      all.findIndex((row) => row.currency === 'SEK'),
    );
    expect(all.findIndex((row) => row.currency === 'EUR')).toBeGreaterThan(
      all.findIndex((row) => row.currency === 'DKK'),
    );
  });

  it('reads the published hour for each city', () => {
    const byId = new Map(publishedParking().map((row) => [row.id, row.amount]));
    expect(byId.get('se-goteborg-focus')).toBe(30);
    expect(byId.get('se-malmo-taxa-a')).toBe(30);
    expect(byId.get('se-malmo-taxa-f')).toBe(5);
    expect(byId.get('no-oslo-ring-1')).toBe(93);
    expect(byId.get('no-oslo-utenfor-ring-3')).toBe(21);
    expect(byId.get('fi-helsinki-zone-1')).toBe(4);
    expect(byId.get('fi-helsinki-zone-2')).toBe(2);
    expect(byId.get('dk-kobenhavn-rod')).toBe(45);
    expect(byId.get('dk-kobenhavn-gul')).toBe(17);
    expect(parkingCities('NO')).toEqual(['oslo']);
    expect(parkingSearchPath(parkingFiltersFromSearch({}))).toBe('/parkering');
    expect(parkingSearchPath(parkingFiltersFromSearch({ country: 'SE', city: 'malmo' }))).toBe(
      '/parkering?country=SE&city=malmo',
    );
    expect(parkingFiltersFromSearch({ country: 'SE', city: 'oslo' }).city).toBeNull();
  });
});
