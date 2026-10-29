import { describe, expect, it } from 'vitest';
import {
  schoolInitials,
  schoolMarkSymbol,
  schoolPortraitUrl,
  schoolShowsLightVehicleMark,
} from '@/lib/discovery/school-portrait';

describe('schoolPortraitUrl', () => {
  it('rejects empty, svg, and logo paths', () => {
    expect(schoolPortraitUrl('')).toBeNull();
    expect(schoolPortraitUrl('https://x.se/logo.png')).toBeNull();
    expect(schoolPortraitUrl('https://x.se/icon.svg')).toBeNull();
    expect(schoolPortraitUrl('https://nobina.com/wp-content/logo-white.png')).toBeNull();
  });

  it('allows a plain photograph path', () => {
    expect(schoolPortraitUrl('https://cdn.example.test/staff/anna.jpg')).toBe(
      'https://cdn.example.test/staff/anna.jpg',
    );
  });
});

describe('schoolInitials', () => {
  it('uses up to two words', () => {
    expect(schoolInitials('Alingsås Trafikskola AB')).toBe('AT');
  });
});

describe('schoolShowsLightVehicleMark', () => {
  it('is true when the listing has light-vehicle categories', () => {
    expect(schoolShowsLightVehicleMark(['B'])).toBe(true);
    expect(schoolShowsLightVehicleMark(['B', 'BE'])).toBe(true);
  });

  it('is false for heavy-only listings with no car categories', () => {
    expect(schoolShowsLightVehicleMark([])).toBe(false);
  });
});

describe('schoolMarkSymbol', () => {
  const heavyC = { categories: ['C'] as const, ykb: false };

  it('prefers car on the light directory when both are advertised', () => {
    expect(schoolMarkSymbol(['B'], heavyC)).toBe('light');
  });

  it('shows truck for heavy-only schools', () => {
    expect(schoolMarkSymbol([], heavyC)).toBe('heavy');
    expect(schoolMarkSymbol([], { categories: [], ykb: true })).toBe('heavy');
  });

  it('shows truck on the heavy directory even when car is also listed', () => {
    expect(schoolMarkSymbol(['B'], heavyC, { heavyScope: true })).toBe('heavy');
  });

  it('falls back to initials when no categories are advertised', () => {
    expect(schoolMarkSymbol([], null)).toBe('initials');
  });
});
