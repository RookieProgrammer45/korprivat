import { describe, expect, it } from 'vitest';
import {
  pageOfWorkshops,
  parseWorkshop,
  WORKSHOP_PAGE_SIZE,
  workshopAddress,
  workshopCities,
  workshopFiltersFromSearch,
  workshopsForCity,
} from '@/lib/discovery/workshops';

const mekonomen = {
  id: 'node/656034948',
  name: 'Mekonomen',
  street: '14 Anderstorpsvägen',
  postcode: '171 54',
  city: 'Solna',
  website: 'https://www.mekonomen.se/',
  sourceUrl: 'https://www.openstreetmap.org/node/656034948',
};

describe('workshops', () => {
  it('keeps a mapped workshop with its address and drops a nameless entry', () => {
    const row = parseWorkshop('SE', mekonomen);
    expect(row?.name).toBe('Mekonomen');
    if (!row) throw new Error('expected workshop');
    expect(workshopAddress(row)).toBe('14 Anderstorpsvägen, 171 54 Solna');
    expect(parseWorkshop('SE', { ...mekonomen, name: '  ' })).toBeNull();
    expect(parseWorkshop('SE', { ...mekonomen, sourceUrl: 'http://example.com' })).toBeNull();
    expect(parseWorkshop('SE', { ...mekonomen, website: '' })?.website).toBe('');
  });

  it('lists a city and matches it without treating a neighbouring city as the same place', () => {
    const solna = parseWorkshop('SE', mekonomen);
    const stockholm = parseWorkshop('SE', {
      ...mekonomen,
      id: 'node/2',
      name: 'Verkstad',
      city: 'Stockholm',
      street: '1 Kungsgatan',
      postcode: '111 43',
      sourceUrl: 'https://www.openstreetmap.org/node/2',
    });
    const unnamed = parseWorkshop('SE', {
      ...mekonomen,
      id: 'way/3',
      city: '',
      street: '',
      postcode: '',
      sourceUrl: 'https://www.openstreetmap.org/way/3',
    });
    const rows = [solna, stockholm, unnamed].filter((row) => row !== null);
    expect(workshopCities(rows)).toEqual(['Solna', 'Stockholm']);
    expect(workshopsForCity(rows, 'Stockholm').map((row) => row.name)).toEqual(['Verkstad']);
    expect(workshopsForCity(rows, 'Solna').map((row) => row.city)).toEqual(['Solna']);
    expect(workshopsForCity(rows, null)).toEqual([]);
    expect(workshopsForCity(rows, '__none')).toHaveLength(1);
  });

  it('pages a long city list and ignores a country that was not collected', () => {
    const rows = Array.from({ length: WORKSHOP_PAGE_SIZE + 1 }, (_, index) =>
      parseWorkshop('SE', {
        ...mekonomen,
        id: `node/${index + 1}`,
        name: `Verkstad ${index}`,
        sourceUrl: `https://www.openstreetmap.org/node/${index + 1}`,
      }),
    ).filter((row) => row !== null);
    const page = pageOfWorkshops(rows, 2);
    expect(page.total).toBe(WORKSHOP_PAGE_SIZE + 1);
    expect(page.pages).toBe(2);
    expect(page.rows).toHaveLength(1);
    expect(workshopFiltersFromSearch({ country: 'US', city: '  New York  ' }, ['SE'])).toEqual({
      country: 'SE',
      city: 'New York',
      page: 1,
    });
  });
});
