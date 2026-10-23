import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUnique, findMany } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { findUnique },
    availabilitySlot: { findMany },
    schoolAuthorizationEvent: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { GET } from '@/app/api/instructors/[id]/availability/route';

describe('GET /api/instructors/[id]/availability', () => {
  beforeEach(() => {
    findUnique.mockReset();
    findMany.mockReset();
    vi.stubEnv('SCHOOL_AUTHZ_ENFORCEMENT', '1');
  });

  it('SC-13 returns no times when availability_display is not granted', async () => {
    findUnique.mockResolvedValue({
      providerRole: 'SCHOOL',
      city: 'Sjöbo',
      bookingMode: 'instant',
    });
    findMany.mockResolvedValue([
      {
        id: 'slot-1',
        instructorId: 'listing-1',
        startsAt: new Date('2030-01-01T10:00:00.000Z'),
        endsAt: new Date('2030-01-01T11:00:00.000Z'),
        durationMinutes: 60,
        bookedAt: null,
      },
    ]);
    const response = await GET(
      new Request('http://localhost/api/instructors/listing-1/availability'),
      {
        params: Promise.resolve({ id: 'listing-1' }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: unknown[] };
    expect(body.items).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns times when enforcement is off and nothing has been withdrawn', async () => {
    vi.stubEnv('SCHOOL_AUTHZ_ENFORCEMENT', '0');
    findUnique.mockResolvedValue({
      providerRole: 'SCHOOL',
      city: 'Malmö',
      bookingMode: 'instant',
    });
    findMany.mockResolvedValue([
      {
        id: 'slot-1',
        instructorId: 'listing-1',
        startsAt: new Date('2030-01-01T10:00:00.000Z'),
        endsAt: new Date('2030-01-01T11:00:00.000Z'),
        durationMinutes: 60,
        bookedAt: null,
      },
    ]);
    const response = await GET(
      new Request('http://localhost/api/instructors/listing-1/availability'),
      {
        params: Promise.resolve({ id: 'listing-1' }),
      },
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { items: { id: string }[] };
    expect(body.items.map((item) => item.id)).toEqual(['slot-1']);
  });
});
