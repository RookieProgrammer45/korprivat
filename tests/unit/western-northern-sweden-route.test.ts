import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/western-northern-sweden/route';
import { WesternNorthernSwedenHub } from '@/lib/contracts/western-northern-sweden';

function request(locale?: string): NextRequest {
  const query = locale === undefined ? '' : `?locale=${encodeURIComponent(locale)}`;
  return new NextRequest(`http://localhost/api/western-northern-sweden${query}`);
}

describe('GET /api/western-northern-sweden', () => {
  it('returns the Swedish hub with all four region slugs and city listing links', async () => {
    const response = await GET(request('sv'));
    expect(response.status).toBe(200);

    const body = WesternNorthernSwedenHub.parse(await response.json());
    expect(body.locale).toBe('sv');
    expect(body.regions.map((region) => region.slug)).toEqual([
      'vastra-gotaland',
      'varmland',
      'gavleborg-vasternorrland',
      'vasterbotten-norrbotten',
    ]);
    expect(body.regions[0]?.cities[0]).toEqual({
      label: 'Göteborg',
      href: '/instructors/goteborg',
    });
    expect(body.regions[0]?.cities[1]?.href).toBe('/instructors?city=Bor%C3%A5s');
    expect(body.regions[2]?.cities.map((city) => city.href)).toContain(
      '/instructors?city=%C3%96rnsk%C3%B6ldsvik',
    );
    expect(body.regions[3]?.cities.map((city) => city.href)).toContain(
      '/instructors?city=Skellefte%C3%A5',
    );
  });

  it('returns the English copy from the same validated response shape', async () => {
    const response = await GET(request('en'));
    const body = WesternNorthernSwedenHub.parse(await response.json());

    expect(body.locale).toBe('en');
    expect(body.hero.title).toContain('west to the north');
    expect(body.regions).toHaveLength(4);
    expect(body.regions.flatMap((region) => region.cities)).toHaveLength(15);
  });

  it('falls back to the configured default locale for an invalid value', async () => {
    const response = await GET(request('de'));
    const body = WesternNorthernSwedenHub.parse(await response.json());

    expect(body.locale).toBe('sv');
    expect(body.hero.title).toContain('väst till norr');
  });

  it('stays a public editorial route without DB or auth dependencies', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/western-northern-sweden/route.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/(db|auth|require-auth|require-admin)/);
  });
});
