import { describe, expect, it } from 'vitest';
import { estimateMarketPrice, type MarketComparable } from '@/lib/discovery/vehicle-market-price';

function car(
  overrides: Partial<MarketComparable> & Pick<MarketComparable, 'price'>,
): MarketComparable {
  return {
    country: 'SE',
    dealerId: 'dealer-a',
    dealerName: 'Dealer A',
    dealerCity: 'Stockholm',
    sourceUrl: 'https://dealer.example/car',
    name: 'Volvo XC60',
    make: 'Volvo',
    model: 'XC60',
    year: 2020,
    currency: 'SEK',
    priceKind: null,
    ...overrides,
  };
}

describe('estimateMarketPrice', () => {
  it('returns the median of advertised prices in the same currency and country', () => {
    const estimate = estimateMarketPrice(
      { make: 'Volvo', model: 'XC60', year: 2020, country: 'SE', currency: 'SEK' },
      [
        car({ price: 300_000, dealerId: 'a' }),
        car({ price: 360_000, dealerId: 'b', dealerName: 'Dealer B' }),
        car({ price: 420_000, dealerId: 'c', dealerName: 'Dealer C' }),
        car({ price: 90_000, currency: 'EUR', country: 'DE', dealerId: 'd' }),
        car({ price: 500_000, priceKind: 'msrp', dealerId: 'e' }),
      ],
    );
    expect(estimate.amount).toBe(360_000);
    expect(estimate.count).toBe(3);
    expect(estimate.currency).toBe('SEK');
    expect(estimate.buyers.map((buyer) => buyer.dealerId).sort()).toEqual(['a', 'b', 'c', 'e']);
  });

  it('does not invent a price when fewer than three advertised cars match', () => {
    const estimate = estimateMarketPrice(
      { make: 'Volvo', model: 'XC60', year: null, country: 'SE', currency: 'SEK' },
      [car({ price: 300_000 }), car({ price: 310_000, priceKind: 'from' })],
    );
    expect(estimate.amount).toBeNull();
    expect(estimate.count).toBe(0);
  });

  it('narrows to cars within three years when that sample is large enough', () => {
    const estimate = estimateMarketPrice(
      { make: 'Volvo', model: 'XC60', year: 2020, country: 'SE', currency: 'SEK' },
      [
        car({ price: 300_000, year: 2019, dealerId: 'a' }),
        car({ price: 320_000, year: 2021, dealerId: 'b' }),
        car({ price: 340_000, year: 2020, dealerId: 'c' }),
        car({ price: 90_000, year: 2010, dealerId: 'd' }),
      ],
    );
    expect(estimate.amount).toBe(320_000);
    expect(estimate.count).toBe(3);
  });

  it('lists a dealer who published a list price without using that price in the median', () => {
    const estimate = estimateMarketPrice(
      { make: 'Volvo', model: 'XC60', year: null, country: 'SE', currency: 'SEK' },
      [car({ price: 500_000, priceKind: 'msrp', dealerId: 'list-price' })],
    );
    expect(estimate.amount).toBeNull();
    expect(estimate.buyers.map((buyer) => buyer.dealerId)).toEqual(['list-price']);
  });

  it('keeps a same-country dealer even when the price sample is too small', () => {
    const estimate = estimateMarketPrice(
      { make: 'Volvo', model: 'XC60', year: null, country: 'AU', currency: 'AUD' },
      [car({ price: 40_000, country: 'AU', currency: 'AUD', dealerId: 'au-1' })],
    );
    expect(estimate.amount).toBeNull();
    expect(estimate.buyers).toEqual([
      {
        dealerId: 'au-1',
        name: 'Dealer A',
        city: 'Stockholm',
        sourceUrl: 'https://dealer.example/car',
      },
    ]);
  });
});
