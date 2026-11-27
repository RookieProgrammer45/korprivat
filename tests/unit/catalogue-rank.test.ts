import { describe, expect, it } from 'vitest';
import {
  EMPTY_MODEL,
  learnClick,
  type Rankable,
  rankCatalogue,
} from '@/lib/discovery/catalogue-rank';

const NOW = Date.parse('2026-11-27T12:00:00Z');

function row(partial: Partial<Rankable> & Pick<Rankable, 'id' | 'amount' | 'currency'>): Rankable {
  return {
    country: 'SE',
    checkedAt: '2026-11-27',
    ...partial,
  };
}

describe('catalogue rank', () => {
  it('keeps published price order until someone opens a listing', () => {
    const rows = [
      row({ id: 'euro', amount: 10, currency: 'EUR', country: 'FI' }),
      row({ id: 'cheap-sek', amount: 100, currency: 'SEK' }),
      row({ id: 'nok', amount: 1, currency: 'NOK', country: 'NO' }),
      row({ id: 'dear-sek', amount: 400, currency: 'SEK' }),
    ];
    const ordered = rankCatalogue(rows, (item) => item, EMPTY_MODEL, 'SE', NOW);
    expect(ordered.map((item) => item.id)).toEqual(['cheap-sek', 'dear-sek', 'nok', 'euro']);
    expect(ordered.map((item) => item.amount)).toEqual([100, 400, 1, 10]);
  });

  it('moves a close listing forward and leaves a much higher price where it is', () => {
    const rows = [
      row({ id: 'low', amount: 100, currency: 'SEK' }),
      row({ id: 'near', amount: 101, currency: 'SEK' }),
      row({ id: 'high', amount: 400, currency: 'SEK' }),
    ];
    const opened = rows[1];
    if (!opened) throw new Error('missing row');
    let model = EMPTY_MODEL;
    for (let step = 0; step < 30; step += 1) {
      model = learnClick(model, opened, 'SE', NOW);
    }
    const ordered = rankCatalogue(rows, (item) => item, model, 'SE', NOW);
    expect(ordered.map((item) => item.id)).toEqual(['near', 'low', 'high']);
    expect(ordered.map((item) => item.amount)).toEqual([101, 100, 400]);
  });

  it('does not let a learned click move a row into another currency', () => {
    const rows = [
      row({ id: 'sek', amount: 100, currency: 'SEK' }),
      row({ id: 'nok', amount: 50, currency: 'NOK', country: 'NO' }),
    ];
    const opened = rows[1];
    if (!opened) throw new Error('missing row');
    let model = EMPTY_MODEL;
    for (let step = 0; step < 40; step += 1) {
      model = learnClick(model, opened, 'NO', NOW);
    }
    const ordered = rankCatalogue(rows, (item) => item, model, 'NO', NOW);
    expect(ordered.map((item) => item.id)).toEqual(['sek', 'nok']);
  });

  it('keeps a row with no published amount after the priced rows', () => {
    const rows = [
      row({ id: 'missing', amount: null, currency: 'SEK' }),
      row({ id: 'priced', amount: 200, currency: 'SEK' }),
    ];
    const ordered = rankCatalogue(rows, (item) => item, EMPTY_MODEL, '', NOW);
    expect(ordered.map((item) => item.id)).toEqual(['priced', 'missing']);
  });
});
