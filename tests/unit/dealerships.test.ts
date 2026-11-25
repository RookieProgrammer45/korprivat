import { describe, expect, it } from 'vitest';
import { cheapestVehicle, compareDealerships, type Dealership } from '@/lib/discovery/dealerships';
import { dealerSearchPath } from '@/lib/seo/dealer-search-path';

function dealer(partial: Partial<Dealership> & Pick<Dealership, 'id' | 'name'>): Dealership {
  return {
    country: 'SE',
    city: 'Malmö',
    address: '',
    website: null,
    phone: null,
    email: null,
    logoUrl: null,
    brands: [],
    categories: ['Bilhandel'],
    sourceUrl: 'https://www.mrf.se/medlem/sok-medlem/',
    sourceName: 'MRF',
    checkedAt: '2026-11-25',
    vehicles: [],
    ...partial,
  };
}

describe('compareDealerships', () => {
  it('orders by the cheapest published vehicle and leaves unpriced dealers last', () => {
    const pricey = dealer({
      id: 'a',
      name: 'Alfa',
      vehicles: [
        { name: 'Bil', kind: 'car', price: 220000, currency: 'SEK', sourceUrl: 'https://a.se' },
      ],
    });
    const cheap = dealer({
      id: 'b',
      name: 'Beta',
      vehicles: [
        { name: 'Bil', kind: 'car', price: 99000, currency: 'SEK', sourceUrl: 'https://b.se' },
      ],
    });
    const quiet = dealer({ id: 'c', name: 'Ceder' });
    expect([pricey, quiet, cheap].sort(compareDealerships).map((row) => row.id)).toEqual([
      'b',
      'a',
      'c',
    ]);
    expect(cheapestVehicle(pricey)?.price).toBe(220000);
  });

  it('does not rank a cheaper foreign currency ahead of kronor', () => {
    const sek = dealer({
      id: 'sek',
      name: 'Svensson',
      vehicles: [
        { name: 'Bil', kind: 'car', price: 180000, currency: 'SEK', sourceUrl: 'https://a.se' },
      ],
    });
    const nok = dealer({
      id: 'nok',
      name: 'Nilsen',
      country: 'NO',
      vehicles: [
        { name: 'Bil', kind: 'car', price: 90000, currency: 'NOK', sourceUrl: 'https://b.no' },
      ],
    });
    expect([nok, sek].sort(compareDealerships).map((row) => row.id)).toEqual(['sek', 'nok']);
  });

  it('builds a comparison URL from the city and vehicle kind', () => {
    expect(dealerSearchPath('')).toBe('/bilhandlare');
    expect(dealerSearchPath('Oslo', 'car')).toBe('/bilhandlare?city=Oslo&kind=car');
    expect(dealerSearchPath('Malmö', 'nope')).toBe('/bilhandlare?city=Malm%C3%B6');
  });
});
