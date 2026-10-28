// @vitest-environment node

import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { update: vi.fn(), findUnique: vi.fn() },
  userProfile: { findUnique: vi.fn(), create: vi.fn() },
  booking: { findMany: vi.fn() },
  instructor: { findMany: vi.fn(), findFirst: vi.fn() },
  requireAuth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@/lib/business/photo-verification', () => ({
  photoState: vi.fn(async () => ({ status: 'NONE', imageUrl: null, confirmedAt: null })),
}));

import { afterEach, describe, expect, it } from 'vitest';
import { GET, PATCH } from '@/app/api/profile/route';
import { ProfileNameUpdate } from '@/lib/contracts/profile';

const user = {
  id: 'user_test',
  email: 'test@example.test',
  name: 'Stronga',
  role: 'user' as const,
};

afterEach(() => {
  vi.clearAllMocks();
});

function patchRequest(body: unknown): Request {
  return new Request('http://localhost/api/profile', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('ProfileNameUpdate', () => {
  it('trims and collapses whitespace in a display name', () => {
    expect(ProfileNameUpdate.parse({ name: '  Anna   Svensson  ' })).toEqual({
      name: 'Anna Svensson',
    });
  });

  it('rejects an empty or oversized name', () => {
    expect(ProfileNameUpdate.safeParse({ name: '   ' }).success).toBe(false);
    expect(ProfileNameUpdate.safeParse({ name: 'A'.repeat(121) }).success).toBe(false);
  });
});

describe('PATCH /api/profile', () => {
  it('requires a session before writing a name', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));
    expect((await PATCH(patchRequest({ name: 'Anna Svensson' }))).status).toBe(401);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it('rejects invalid JSON and an empty name without touching the user row', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    expect((await PATCH(patchRequest('not-json'))).status).toBe(400);
    expect((await PATCH(patchRequest({ name: '   ' }))).status).toBe(400);
    expect(mocks.user.update).not.toHaveBeenCalled();
  });

  it('saves the trimmed name for the session user', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.user.update.mockResolvedValue({ name: 'Anna Svensson' });
    const response = await PATCH(patchRequest({ name: '  Anna   Svensson  ' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ name: 'Anna Svensson' });
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { name: 'Anna Svensson' },
      select: { name: true },
    });
  });

  it('reads the stored name on GET so the dashboard shows the saved value', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.userProfile.findUnique.mockResolvedValue({ role: 'STUDENT' });
    mocks.user.findUnique.mockResolvedValue({
      name: 'Anna Svensson',
      email: user.email,
      image: null,
    });
    mocks.booking.findMany.mockResolvedValue([]);
    const response = await GET(new Request('http://localhost/api/profile'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      user: { name: 'Anna Svensson', email: user.email },
    });
  });
});
