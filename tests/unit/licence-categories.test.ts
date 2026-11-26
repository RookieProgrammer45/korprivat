import { describe, expect, it } from 'vitest';
import {
  categoryFilterMatches,
  withUsualMotorcycleCategories,
} from '@/lib/business/licence-categories';

describe('published licence categories', () => {
  it('does not add motorcycle categories to a car school', () => {
    expect(withUsualMotorcycleCategories(['B'])).toEqual(['B']);
  });

  it('keeps a motorcycle category the school actually stores', () => {
    expect(withUsualMotorcycleCategories(['A', 'B'])).toEqual(['A', 'B']);
  });

  it('does not let a motorcycle search match car-only listings', () => {
    expect(categoryFilterMatches(['A'])).toEqual(['A']);
    expect(categoryFilterMatches(['B'])).toEqual(['B']);
  });
});
