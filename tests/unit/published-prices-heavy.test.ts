import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { heavyListingWhere, lightCatalogueWhere } from '@/lib/discovery/published-prices';

describe('heavyListingWhere', () => {
  it('lists every C, D and YKB school for the heavy catalogue, not an empty filter', () => {
    const all = heavyListingWhere('all').id.in;
    const truck = heavyListingWhere('truck').id.in;
    const bus = heavyListingWhere('bus').id.in;
    const ykb = heavyListingWhere('ykb').id.in;

    expect(all.length).toBeGreaterThan(0);
    expect(all).not.toContain('__none__');
    expect(new Set(all).size).toBe(all.length);
    expect(truck.every((id) => all.includes(id))).toBe(true);
    expect(bus.every((id) => all.includes(id))).toBe(true);
    expect(ykb.every((id) => all.includes(id))).toBe(true);
  });
});

describe('lightCatalogueWhere', () => {
  it('keeps C/D-only schools out of the light-vehicle catalogue', () => {
    const light = lightCatalogueWhere();
    const heavyOnly = light.id?.notIn ?? [];
    const heavyAll = new Set(heavyListingWhere('all').id.in);

    expect(heavyOnly.length).toBeGreaterThan(0);
    expect(heavyOnly.every((id) => heavyAll.has(id))).toBe(true);
  });
});
