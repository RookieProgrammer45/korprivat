import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCount, mockFindUnique, mockRequireAuth } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRequireAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    instructor: { count: mockCount },
    userProfile: { findUnique: mockFindUnique },
  },
}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mockRequireAuth }));

import { GET } from '@/app/api/dashboard/provider-activation/route';
import { LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';

describe('GET /api/dashboard/provider-activation', () => {
  beforeEach(() => {
    mockCount.mockReset();
    mockFindUnique.mockReset();
    mockRequireAuth.mockReset();
  });

  it('returns 401 without an authenticated session', async () => {
    mockRequireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));

    const response = await GET(new Request('http://localhost/api/dashboard/provider-activation'));

    expect(response.status).toBe(401);
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('returns 403 for a student profile', async () => {
    mockRequireAuth.mockResolvedValueOnce({ id: 'user_student' });
    mockFindUnique.mockResolvedValueOnce({ role: 'STUDENT' });

    const response = await GET(new Request('http://localhost/api/dashboard/provider-activation'));

    expect(response.status).toBe(403);
    expect(mockCount).not.toHaveBeenCalled();
  });

  it.each(['INSTRUCTOR', 'HANDLEDARE'])('returns the activation count for %s', async (role) => {
    mockRequireAuth.mockResolvedValueOnce({ id: `user_${role.toLowerCase()}` });
    mockFindUnique.mockResolvedValueOnce({ role });
    mockCount.mockResolvedValueOnce(7);

    const response = await GET(new Request('http://localhost/api/dashboard/provider-activation'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      activatedCount: 7,
      trend: { status: 'neutral' },
    });
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId: `user_${role.toLowerCase()}` },
      select: { role: true },
    });
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: LICENCE_CATEGORY_CODES.map((code) => ({ categories: { has: code } })),
          },
          {
            OR: [{ providerRole: null }, { providerRole: { not: 'HANDLEDARE' } }],
          },
        ],
      },
    });
  });
});
