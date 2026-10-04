import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { GET } from '@/app/api/southern-sweden/route';
import { SouthernSwedenHub } from '@/lib/contracts/southern-sweden';

function request(locale?: string): NextRequest {
  const query = locale === undefined ? '' : `?locale=${encodeURIComponent(locale)}`;
  return new NextRequest(`http://localhost/api/southern-sweden${query}`);
}

describe('GET /api/southern-sweden', () => {
  it('returns the Swedish hub with all four region slugs and city listing links', async () => {
    const response = await GET(request('sv'));
    expect(response.status).toBe(200);

    const body = SouthernSwedenHub.parse(await response.json());
    expect(body.locale).toBe('sv');
    expect(body.regions.map((region) => region.slug)).toEqual([
      'skane',
      'halland',
      'blekinge',
      'smaland',
    ]);
    expect(body.regions[0]?.cities[0]).toEqual({
      label: 'Malmö',
      href: '/locations/se/malmo',
    });
    expect(body.regions[3]?.cities.map((city) => city.href)).toContain(
      '/locations/se/jonkoping',
    );
  });

  it('returns the English copy from the same validated response shape', async () => {
    const response = await GET(request('en'));
    const body = SouthernSwedenHub.parse(await response.json());

    expect(body.locale).toBe('en');
    expect(body.hero.title).toContain('Southern Sweden');
    expect(body.regions).toHaveLength(4);
    expect(body.regions.flatMap((region) => region.cities)).toHaveLength(18);
  });

  it('falls back to the configured default locale for an invalid value', async () => {
    const response = await GET(request('de'));
    const body = SouthernSwedenHub.parse(await response.json());

    expect(body.locale).toBe('sv');
    expect(body.hero.title).toContain('södra Sverige');
  });

  it('stays a public editorial route without DB or auth dependencies', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/app/api/southern-sweden/route.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/@\/lib\/(db|auth|require-auth|require-admin)/);
  });
});
