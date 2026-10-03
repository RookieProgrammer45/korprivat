// Mock @vercel/blob put() used by object-storage for profile pictures.

import { vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  put: vi.fn(async (_pathname: string) => ({
    url: 'https://cdn.polsia.com/mock/key.png',
    pathname: 'mock/key.png',
    contentType: 'image/png',
    contentDisposition: 'inline',
  })),
}));

vi.mock('@vercel/blob', () => ({
  put: hoisted.put,
}));

export const blobPutMock = hoisted.put;

export function resetBlobMock(): void {
  hoisted.put.mockReset();
  hoisted.put.mockResolvedValue({
    url: 'https://cdn.polsia.com/mock/key.png',
    pathname: 'mock/key.png',
    contentType: 'image/png',
    contentDisposition: 'inline',
  });
}
