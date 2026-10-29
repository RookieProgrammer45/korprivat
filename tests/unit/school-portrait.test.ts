import { describe, expect, it } from 'vitest';
import { schoolInitials, schoolPortraitUrl } from '@/lib/discovery/school-portrait';

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
