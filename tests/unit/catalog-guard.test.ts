import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetSession, mockRedirect } = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('next/navigation', () => ({ redirect: mockRedirect }));
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mockGetSession } } }));

import { requireCatalogSession } from '@/lib/catalog-guard';

describe('requireCatalogSession', () => {
  beforeEach(() => {
    mockGetSession.mockReset();
    mockRedirect.mockClear();
  });

  it('redirects unsigned visitors to login with the return path', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await expect(requireCatalogSession('/instructors?city=Stockholm')).rejects.toThrow(
      'REDIRECT:/login?next=%2Finstructors%3Fcity%3DStockholm',
    );
  });

  it('rejects an open-redirect next path', async () => {
    mockGetSession.mockResolvedValueOnce(null);
    await expect(requireCatalogSession('https://evil.test')).rejects.toThrow(
      'REDIRECT:/login?next=%2Finstructors',
    );
  });

  it('returns when a session exists', async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: 'u1' } });
    await expect(requireCatalogSession('/instructors')).resolves.toBeUndefined();
    expect(mockRedirect).not.toHaveBeenCalled();
  });
});
