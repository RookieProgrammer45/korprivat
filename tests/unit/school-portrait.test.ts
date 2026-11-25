import { describe, expect, it } from 'vitest';
import {
  schoolInitials,
  schoolMarkSymbol,
  schoolPortraitUrl,
  schoolShowsLightVehicleMark,
} from '@/lib/discovery/school-portrait';

describe('schoolPortraitUrl', () => {
  it('rejects empty and non-http values', () => {
    expect(schoolPortraitUrl('')).toBeNull();
    expect(schoolPortraitUrl('/brand/logo-black.svg')).toBeNull();
    expect(schoolPortraitUrl('javascript:alert(1)')).toBeNull();
  });

  it('allows a scraped logo, including svg', () => {
    expect(schoolPortraitUrl('https://x.se/logo.png')).toBe('https://x.se/logo.png');
    expect(schoolPortraitUrl('https://x.se/icon.svg')).toBe('https://x.se/icon.svg');
    expect(schoolPortraitUrl('https://nobina.com/wp-content/logo-white.png')).toBe(
      'https://nobina.com/wp-content/logo-white.png',
    );
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
