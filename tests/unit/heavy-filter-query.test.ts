import { describe, expect, it } from 'vitest';
import { InstructorItem, parseInstructorQuery } from '@/lib/contracts/instructors';

describe('heavy-vehicle directory filter', () => {
  it('accepts truck, bus and ykb', () => {
    for (const heavy of ['truck', 'bus', 'ykb'] as const) {
      const parsed = parseInstructorQuery(new URLSearchParams({ heavy }));
      expect(parsed.ok && parsed.value.heavy).toBe(heavy);
    }
  });

  it('ignores unknown values instead of failing the search', () => {
    const parsed = parseInstructorQuery(new URLSearchParams({ heavy: 'tractor' }));
    expect(parsed.ok && parsed.value.heavy).toBeUndefined();
  });

  it('keeps heavy categories out of the bookable licence categories', () => {
    const parsed = parseInstructorQuery(new URLSearchParams({ categories: 'CE' }));
    expect(parsed.ok).toBe(false);
  });

  it('rejects a heavy price the contract does not know', () => {
    const heavy = InstructorItem.shape.publishedPrices
      .unwrap()
      .unwrap()
      .shape.heavy.unwrap()
      .unwrap();
    const base = { categories: ['CE'], ykb: true, sourceUrl: null, collectedAt: '2026-10-26' };
    const price = {
      kind: 'course',
      name: 'CE-utbildning',
      minutes: null,
      hours: null,
      priceSek: 42_000,
    };
    expect(heavy.safeParse({ ...base, prices: [{ ...price, category: 'CE' }] }).success).toBe(true);
    expect(heavy.safeParse({ ...base, prices: [{ ...price, category: 'B' }] }).success).toBe(false);
  });
});
