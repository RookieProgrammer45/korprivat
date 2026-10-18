import { describe, expect, it } from 'vitest';
import { parseSchoolSlug, schoolPath, slugifyText } from '@/lib/seo/school-slugs';

describe('school-slugs', () => {
  it('slugifies Swedish names and cities to ASCII dash form', () => {
    expect(slugifyText('Göteborg')).toBe('goteborg');
    expect(slugifyText('Moderna Trafikskola AB')).toBe('moderna-trafikskola-ab');
    expect(slugifyText('  Körkortshuset  i  Sollentuna! ')).toBe('korkortshuset-i-sollentuna');
  });

  it('builds keyword-rich canonical paths with a collision-free id suffix', () => {
    expect(
      schoolPath({
        id: '7cb0cb93-1234-4abc-9def-a1b2c3d4e5f6',
        name: 'Moderna Trafikskola',
        city: 'Göteborg',
      }),
    ).toBe('/trafikskola/goteborg/moderna-trafikskola-7cb0cb93');
  });

  it('falls back to safe slugs for empty names/cities', () => {
    expect(
      schoolPath({ id: 'abcdefab-0000-0000-0000-000000000000', name: '   ', city: 'Åre' }),
    ).toBe('/trafikskola/are/trafikskola-abcdefab');
  });

  it('parses slug + id suffix and rejects slugs without one', () => {
    expect(parseSchoolSlug('moderna-trafikskola-7cb0cb93')).toEqual({
      nameSlug: 'moderna-trafikskola',
      id8: '7cb0cb93',
    });
    expect(parseSchoolSlug('moderna-trafikskola')).toBeNull();
    expect(parseSchoolSlug('ab-1234567')).toBeNull();
  });
});
