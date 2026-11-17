import { describe, expect, it } from 'vitest';
import { compareByPublishedLessonPrice } from '@/lib/discovery/published-lesson-order';

describe('compareByPublishedLessonPrice', () => {
  it('orders by the website lesson and leaves an unpublished price last', () => {
    const rows = [
      { name: 'Beta', publishedPrices: { lesson: { priceSek: 900 } } },
      { name: 'Alfa', publishedPrices: null, hourlyRateSek: 100 },
      { name: 'Gamma', publishedPrices: { lesson: { priceSek: 500 } } },
    ];
    expect([...rows].sort(compareByPublishedLessonPrice).map((row) => row.name)).toEqual([
      'Gamma',
      'Beta',
      'Alfa',
    ]);
  });
});
