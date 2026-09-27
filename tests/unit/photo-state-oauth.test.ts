// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  photoVerification: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    photoVerification: mocks.photoVerification,
    user: mocks.user,
  },
}));

import { photoState } from '@/lib/business/photo-verification';

describe('photoState OAuth avatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not treat User.image alone as signup photo CONFIRMED', async () => {
    mocks.photoVerification.findUnique.mockResolvedValue(null);
    mocks.user.findUnique.mockResolvedValue({
      image: 'https://lh3.googleusercontent.com/a/oauth-avatar',
    });

    const state = await photoState('user_oauth');

    expect(state.status).toBe('NONE');
    expect(state.imageUrl).toBe('https://lh3.googleusercontent.com/a/oauth-avatar');
  });

  it('still reports CONFIRMED when PhotoVerification is confirmed', async () => {
    const confirmedAt = new Date('2026-01-01T00:00:00.000Z');
    mocks.photoVerification.findUnique.mockResolvedValue({
      status: 'CONFIRMED',
      stagedUrl: 'https://cdn.test/confirmed.png',
      confirmedAt,
    });
    mocks.user.findUnique.mockResolvedValue({ image: 'https://cdn.test/confirmed.png' });

    const state = await photoState('user_confirmed');

    expect(state.status).toBe('CONFIRMED');
    expect(state.imageUrl).toBe('https://cdn.test/confirmed.png');
    expect(state.confirmedAt).toBe(confirmedAt.toISOString());
  });
});
