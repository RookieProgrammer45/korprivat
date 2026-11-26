import { describe, expect, it } from 'vitest';
import { listParts, searchParts } from '@/lib/discovery/parts';
import { partsSearchPath } from '@/lib/seo/parts-search-path';

describe('parts catalogue', () => {
  it('lists a published car part for an owner and a workshop in more than one country', () => {
    const parts = listParts();
    const owner = parts.filter((part) => part.buyers.includes('owner'));
    const workshop = parts.filter((part) => part.buyers.includes('workshop'));
    expect(
      owner.some((part) => part.sellerCountry === 'AU' && /floor mat/i.test(part.category ?? '')),
    ).toBe(true);
    expect(
      workshop.some(
        (part) => part.sellerCountry === 'AU' && /brake disc pad/i.test(part.category ?? ''),
      ),
    ).toBe(true);
    expect(workshop.some((part) => part.sellerCountry === 'SE' && /broms/i.test(part.name))).toBe(
      true,
    );
    expect(searchParts({ q: 'bromsbelägg', buyer: 'owner', country: 'SE' }).length).toBeGreaterThan(
      0,
    );
    expect(
      parts.some((part) => /cykelvagn|bastulampa/i.test(`${part.category} ${part.name}`)),
    ).toBe(false);
  });

  it('reads a published price and specification from the seller file', () => {
    const parts = listParts();
    expect(parts.length).toBeGreaterThan(20);
    expect(parts.every((part) => part.price > 0 && part.specs.length > 0)).toBe(true);
    expect(parts.every((part) => part.sourceUrl.startsWith('https://'))).toBe(true);
    expect(parts.some((part) => /hjälm/i.test(part.name) && part.kind === 'motorcycle')).toBe(true);
    expect(new Set(parts.map((part) => part.sellerName)).size).toBeGreaterThan(1);
    const helmetSellers = new Set(
      searchParts({ q: 'hjälm' })
        .filter((part) => part.currency === 'SEK')
        .map((part) => part.sellerName),
    );
    expect(helmetSellers.size).toBeGreaterThan(1);
  });

  it('matches a helmet search and keeps a brake pad out of it', () => {
    const helmets = searchParts({ q: 'integralhjälm', kind: 'motorcycle' });
    expect(helmets.length).toBeGreaterThan(0);
    expect(helmets.every((part) => part.name.toLocaleLowerCase().includes('integralhjälm'))).toBe(
      true,
    );
    expect(
      searchParts({ q: 'torkarblad', kind: 'part' }).some((part) => /hjälm/i.test(part.name)),
    ).toBe(false);
  });

  it('does not rank a dollar price ahead of kronor', () => {
    const ranked = searchParts({}, [
      {
        id: 'us',
        name: 'Helmet',
        brand: null,
        kind: 'motorcycle',
        category: null,
        price: 10,
        currency: 'USD',
        specs: ['ECE'],
        imageUrl: null,
        sourceUrl: 'https://example.com/helmet',
        sellerName: 'Shop',
        sellerCountry: 'US',
        checkedAt: '2026-11-26',
        stores: [],
        buyers: ['rider'],
      },
      {
        id: 'se',
        name: 'Blad',
        brand: null,
        kind: 'part',
        category: null,
        price: 500,
        currency: 'SEK',
        specs: ['40 cm'],
        imageUrl: null,
        sourceUrl: 'https://example.com/blade',
        sellerName: 'Shop',
        sellerCountry: 'SE',
        checkedAt: '2026-11-26',
        stores: [],
        buyers: ['owner', 'workshop'],
      },
    ]);
    expect(ranked.map((part) => part.currency)).toEqual(['SEK', 'USD']);
    const listed = searchParts({});
    const lastKrona = listed.findLastIndex((part) => part.currency === 'SEK');
    const firstEuro = listed.findIndex((part) => part.currency === 'EUR');
    expect(lastKrona).toBeGreaterThanOrEqual(0);
    expect(firstEuro).toBeGreaterThan(lastKrona);
  });

  it('builds a comparison URL from the product and kind', () => {
    expect(partsSearchPath('')).toBe('/reservdelar');
    expect(partsSearchPath('hjälm', 'motorcycle')).toBe(
      '/reservdelar?q=hj%C3%A4lm&kind=motorcycle',
    );
    expect(partsSearchPath('olja', 'nope')).toBe('/reservdelar?q=olja');
    expect(partsSearchPath('helmet', 'motorcycle', 'New York')).toBe(
      '/reservdelar?q=helmet&place=New+York&kind=motorcycle',
    );
  });

  it('keeps a Connecticut store address and sorts the nearer shop first', () => {
    const store = {
      name: 'Union Garage',
      address: '162 Elm Street',
      city: 'Bridgeport',
      region: 'CT',
      country: 'US',
      latitude: 41.1792402,
      longitude: -73.1923973,
    };
    const brooklyn = {
      ...store,
      name: 'Jane Motorcycles',
      address: '396 Wythe Ave',
      city: 'Brooklyn',
      region: 'NY',
      latitude: 40.7125501,
      longitude: -73.9662077,
    };
    const ranked = searchParts({ place: 'New York' }, [
      {
        id: 'ct',
        name: 'Shoei RF-1500 Helmet',
        brand: 'Shoei',
        kind: 'motorcycle',
        category: 'Helmets',
        price: 699.99,
        currency: 'USD',
        specs: ['AIM+ shell'],
        imageUrl: null,
        sourceUrl: 'https://uniongaragenyc.com/products/shoei',
        sellerName: 'Union Garage',
        sellerCountry: 'US',
        checkedAt: '2026-11-26',
        stores: [store],
        buyers: ['rider'],
      },
      {
        id: 'bk',
        name: 'Bell Helmet',
        brand: 'Bell',
        kind: 'motorcycle',
        category: 'Helmets',
        price: 239,
        currency: 'USD',
        specs: ['Fiberglass shell'],
        imageUrl: null,
        sourceUrl: 'https://janemotorcycles.com/products/bell',
        sellerName: 'Jane Motorcycles',
        sellerCountry: 'US',
        checkedAt: '2026-11-26',
        stores: [brooklyn],
        buyers: ['rider'],
      },
    ]);
    expect(ranked.map((part) => part.nearestStore?.city)).toEqual(['Brooklyn', 'Bridgeport']);
    expect(ranked.every((part) => part.nearestStore?.city !== 'New York')).toBe(true);
    const away = searchParts({ place: 'Rochester' }, ranked);
    expect(away.map((part) => part.id)).toEqual(['bk', 'ct']);
    expect(away.every((part) => part.nearestStore == null && part.nearestKm == null)).toBe(true);
  });

  it('reads a published helmet near New York without renaming the store city', () => {
    const listed = searchParts({ q: 'helmet', place: 'New York', kind: 'motorcycle' });
    const nearby = listed.filter((part) => part.nearestStore);
    expect(nearby.length).toBeGreaterThan(0);
    expect(nearby.every((part) => part.currency === 'USD' && part.specs.length > 1)).toBe(true);
    expect(nearby.every((part) => part.nearestStore?.city === 'Bridgeport')).toBe(true);
    expect(nearby.every((part) => part.nearestStore?.region === 'CT')).toBe(true);
    expect(listed.some((part) => part.currency === 'SEK' && part.nearestStore == null)).toBe(true);
    expect(listed.findIndex((part) => part.nearestStore)).toBeLessThan(
      listed.findIndex((part) => part.currency === 'SEK'),
    );
    const rochester = searchParts({ q: 'helmet', place: 'Rochester', kind: 'motorcycle' });
    expect(rochester.some((part) => part.specs.length > 0)).toBe(true);
    expect(rochester.every((part) => part.nearestStore == null)).toBe(true);
  });

  it('keeps a car-owner accessory out of the workshop list and a workshop part in it', () => {
    const rows = [
      {
        id: 'mat',
        name: 'Rubber floor mat',
        brand: null,
        kind: 'accessory' as const,
        category: 'Floor Mats',
        price: 49,
        currency: 'AUD',
        specs: ['Front pair'],
        imageUrl: null,
        sourceUrl: 'https://www.autoone.com.au/products/mat',
        sellerName: 'Auto One',
        sellerCountry: 'AU',
        checkedAt: '2026-11-26',
        stores: [],
        buyers: ['owner' as const],
      },
      {
        id: 'pad',
        name: 'Brake disc pads',
        brand: null,
        kind: 'part' as const,
        category: 'Brake Disc Pads & Shoes',
        price: 89,
        currency: 'AUD',
        specs: ['Fits the listed axle'],
        imageUrl: null,
        sourceUrl: 'https://www.autoone.com.au/products/pad',
        sellerName: 'Auto One',
        sellerCountry: 'AU',
        checkedAt: '2026-11-26',
        stores: [],
        buyers: ['workshop' as const],
      },
    ];
    expect(searchParts({ buyer: 'owner' }, rows).map((part) => part.id)).toEqual(['mat']);
    expect(searchParts({ buyer: 'workshop', country: 'AU' }, rows).map((part) => part.id)).toEqual([
      'pad',
    ]);
    expect(searchParts({ country: 'SE' }, rows)).toEqual([]);
  });

  it('uses a coordinate the same way as a chosen city', () => {
    const listed = searchParts({ q: 'helmet', kind: 'motorcycle', lat: 40.7127, lng: -74.006 });
    expect(listed.some((part) => part.nearestStore?.city === 'Bridgeport')).toBe(true);
    expect(listed.some((part) => part.nearestKm != null && part.nearestKm < 120)).toBe(true);
  });
});
