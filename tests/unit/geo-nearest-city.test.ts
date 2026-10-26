import { describe, expect, it } from 'vitest';
import { nearestKnownCity } from '@/lib/business/geo';

describe('nearestKnownCity', () => {
  it('returns Stockholm for a central Stockholm coordinate', () => {
    expect(nearestKnownCity(59.3293, 18.0686)).toBe('Stockholm');
  });

  it('returns null when the coordinate is far from a known city', () => {
    expect(nearestKnownCity(40.4168, -3.7038)).toBeNull();
  });
});
