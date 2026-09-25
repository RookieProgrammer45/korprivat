import { describe, expect, it } from 'vitest';
import { seedRows } from '../../src/lib/business/instructor-seeds';
import { buildDemoAvailabilitySlots } from '../../src/lib/business/marketplace-seed';

describe('buildDemoAvailabilitySlots()', () => {
  it('creates future weekday slots for every seeded instructor', () => {
    const now = new Date('2026-09-07T10:00:00.000Z');
    const ids = seedRows.map((row) => row.id);
    const slots = buildDemoAvailabilitySlots(ids, now);

    expect(ids.length).toBeGreaterThanOrEqual(3);
    expect(slots.length).toBe(ids.length * 5 * 2);
    expect(slots.every((slot) => slot.startsAt.getTime() > now.getTime())).toBe(true);
    expect(slots.every((slot) => slot.endsAt.getTime() > slot.startsAt.getTime())).toBe(true);
    expect(slots.every((slot) => [1, 2, 3, 4, 5].includes(slot.startsAt.getUTCDay()))).toBe(true);
  });
});
