// @polsia:user-owned — mandatory photo verification route coverage.
// @vitest-environment node

import { vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  userProfile: { upsert: vi.fn() },
  photoVerification: { findUnique: vi.fn(), upsert: vi.fn() },
  requireAuth: vi.fn(),
  put: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@vercel/blob', () => ({ put: mocks.put }));

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST as confirmPOST } from '@/app/api/profile/picture/confirm/route';
import { POST as uploadPOST } from '@/app/api/profile/picture/route';

const user = { id: 'user_test', email: 'test@example.test', name: 'Test', role: 'user' as const };

beforeEach(() => {
  process.env.BLOB_READ_WRITE_TOKEN = 'test-blob-token';
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.BLOB_READ_WRITE_TOKEN;
});

function uploadRequest(file: File): Request {
  const form = new FormData();
  form.append('file', file, file.name);
  return new Request('http://localhost/api/profile/picture', { method: 'POST', body: form });
}

describe('photo verification', () => {
  it('requires a session and rejects HEIC, empty, and oversized files before storage', async () => {
    mocks.requireAuth.mockRejectedValueOnce(new Response(null, { status: 401 }));
    expect(
      (await uploadPOST(uploadRequest(new File(['x'], 'x.png', { type: 'image/png' })))).status,
    ).toBe(401);

    mocks.requireAuth.mockResolvedValue(user);
    for (const file of [
      new File(['x'], 'portrait.heic', { type: 'image/heic' }),
      new File([], 'empty.png', { type: 'image/png' }),
      new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'large.png', { type: 'image/png' }),
    ]) {
      const response = await uploadPOST(uploadRequest(file));
      expect(response.status).toBe(400);
    }
    expect(mocks.put).not.toHaveBeenCalled();
  });

  it('stages a valid image without replacing the confirmed user image', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.put.mockResolvedValue({
      url: 'https://cdn.test/test.png',
      pathname: 'photos/test.png',
    });
    const response = await uploadPOST(
      uploadRequest(new File(['png'], 'portrait.png', { type: 'image/png' })),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      status: 'STAGED',
      imageUrl: 'https://cdn.test/test.png',
    });
    expect(mocks.user.update).not.toHaveBeenCalled();
    expect(mocks.photoVerification.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: user.id },
        update: expect.objectContaining({ status: 'STAGED' }),
      }),
    );
  });

  it('does not confirm without a staged or legacy image, then confirms idempotently', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.photoVerification.findUnique.mockResolvedValueOnce(null);
    mocks.user.findUnique.mockResolvedValueOnce({ image: null });
    expect(
      (
        await confirmPOST(
          new Request('http://localhost/api/profile/picture/confirm', { method: 'POST' }),
        )
      ).status,
    ).toBe(409);

    const confirmedAt = new Date('2026-01-01T00:00:00.000Z');
    mocks.photoVerification.findUnique.mockResolvedValueOnce({
      status: 'STAGED',
      stagedUrl: 'https://cdn.test/new.png',
      confirmedAt: null,
    });
    mocks.user.findUnique.mockResolvedValueOnce({ image: 'https://cdn.test/old.png' });
    const confirmed = await confirmPOST(
      new Request('http://localhost/api/profile/picture/confirm', { method: 'POST' }),
    );
    expect(confirmed.status).toBe(200);
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: user.id },
      data: { image: 'https://cdn.test/new.png' },
    });

    mocks.photoVerification.findUnique.mockResolvedValueOnce({
      status: 'CONFIRMED',
      stagedUrl: 'https://cdn.test/new.png',
      confirmedAt,
    });
    mocks.user.findUnique.mockResolvedValueOnce({ image: 'https://cdn.test/new.png' });
    const retry = await confirmPOST(
      new Request('http://localhost/api/profile/picture/confirm', { method: 'POST' }),
    );
    expect(retry.status).toBe(200);
    expect(mocks.user.update).toHaveBeenCalledTimes(1);
  });
});
