import { describe, expect, it } from 'vitest';
import {
  pickHomepageCars,
  pickHomepageParts,
  preferredCarCurrency,
  preferredPartCountry,
} from '@/lib/discovery/homepage-offers';

const car = (currency: string) => ({ id: currency, vehicle: { currency } });
const part = (
  id: string,
  country: string,
  currency: string,
  price: number,
  buyers: Array<'owner' | 'workshop' | 'rider'>,
  kind?: string,
  text?: string,
) => ({ id, sellerCountry: country, currency, price, buyers, kind, text });

describe('homepage offer preview', () => {
  it('keeps one car currency and falls back to SEK when the local list is thin', () => {
    expect(preferredCarCurrency('au')).toBe('AUD');
    expect(preferredCarCurrency('de')).toBe('EUR');
    const rows = [car('USD'), car('USD'), car('SEK'), car('SEK'), car('SEK')];
    expect(pickHomepageCars(rows, 'us', 20).every((row) => row.vehicle.currency === 'SEK')).toBe(
      true,
    );
    const usd = Array.from({ length: 8 }, () => car('USD'));
    expect(pickHomepageCars([...usd, car('SEK')], 'us', 20)).toHaveLength(8);
    expect(
      pickHomepageCars([...usd, car('SEK')], 'us', 20).some(
        (row) => row.vehicle.currency === 'SEK',
      ),
    ).toBe(false);
    const sled = { id: 'sled', vehicle: { currency: 'SEK', kind: 'car', name: 'Ski-Doo Summit' } };
    expect(
      pickHomepageCars([sled, ...Array.from({ length: 8 }, () => car('SEK'))], 'se', 20).some(
        (row) => row.id === 'sled',
      ),
    ).toBe(false);
  });

  it('shows published car parts for a driver or a workshop and leaves rider-only gear out', () => {
    expect(preferredPartCountry('fi')).toBe('FI');
    expect(preferredPartCountry('fr')).toBe('FI');
    expect(preferredPartCountry('se')).toBe('SE');
    const rows = [
      part('helmet', 'US', 'USD', 200, ['rider']),
      part('pad-us', 'US', 'USD', 40, ['owner']),
      part('disc', 'SE', 'SEK', 300, ['workshop']),
      part('bulb', 'SE', 'SEK', 20, ['owner', 'workshop']),
      ...Array.from({ length: 8 }, (_, index) =>
        part(`se-${index}`, 'SE', 'SEK', 100 + index, ['owner']),
      ),
    ];
    const us = pickHomepageParts(rows, 'us', 20);
    expect(us.every((row) => row.sellerCountry === 'SE' && row.currency === 'SEK')).toBe(true);
    expect(us.some((row) => row.id === 'helmet')).toBe(false);
    const strap = part('strap', 'SE', 'SEK', 10, ['owner'], 'accessory');
    const moto = part('moto', 'SE', 'SEK', 5, ['owner'], 'part', 'Oljefilter Kawasaki motorcykel');
    const preview = pickHomepageParts([...rows, strap, moto], 'se', 20);
    expect(preview.some((row) => row.id === 'strap' || row.id === 'moto')).toBe(false);
    expect(us[0]?.id).toBe('bulb');
    const finnish = Array.from({ length: 8 }, (_, index) =>
      part(`fi-${index}`, 'FI', 'EUR', 50 + index, ['owner']),
    );
    expect(
      pickHomepageParts([...rows, ...finnish], 'de', 20).every((row) => row.currency === 'EUR'),
    ).toBe(true);
  });
});
