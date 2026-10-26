import { describe, expect, it } from 'vitest';
import {
  categoryFilterMatches,
  withUsualMotorcycleCategories,
} from '@/lib/business/licence-categories';

describe('usual motorcycle offer on B schools', () => {
  it('adds A, A1 and A2 when a school already offers B', () => {
    expect(withUsualMotorcycleCategories(['B'])).toEqual(['A1', 'A2', 'A', 'B']);
  });

  it('does not invent motorcycle categories without B', () => {
    expect(withUsualMotorcycleCategories(['BE'])).toEqual(['BE']);
  });

  it('lets a motorcycle search also match B listings', () => {
    expect(categoryFilterMatches(['A'])).toEqual(expect.arrayContaining(['A', 'B']));
    expect(categoryFilterMatches(['B'])).toEqual(['B']);
  });
});
