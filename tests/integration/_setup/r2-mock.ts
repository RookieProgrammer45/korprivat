//
// /api/profile/picture uses `node-fetch` (per the r2-proxy skill: native fetch
// breaks form-data streams with "Unexpected end of form"). Mocking `node-fetch`
// directly intercepts both the call shape and the auth header. The mock
// returns the R2 shape documented in the skill so the route can persist
// `result.file.url` onto `User.image` without further parsing.
//
// biome: this file is OUTSIDE the overrides' src/** glob so biome's default
// rule set applies; we never import restricted paths here.

import { vi } from 'vitest';

const hoisted = vi.hoisted(() => {
  const upload = vi.fn(async () => ({
    status: 200,
    ok: true,
    json: async () => ({
      success: true,
      file: {
        id: 'mock-r2-id',
        key: 'mock/key.png',
        url: 'https://cdn.polsia.com/mock/key.png',
        filename: 'avatar.png',
        mime_type: 'image/png',
        size: 1024,
        created_at: '2026-07-31T00:00:00Z',
      },
    }),
    text: async () => '',
  }));
  return { upload };
});

// Register the mock at module-load so vitest hoists the default-shape mock
// above the pic route's `import fetch from 'node-fetch'`.
vi.mock('node-fetch', () => ({
  default: hoisted.upload,
}));

export const r2UploadMock = hoisted.upload;

/**
 * Re-attach a happy-path default that returns the canned URL. Tests that
 * need per-case behaviour (e.g. simulate a 502 from the proxy) override
 * with `mockResolvedValueOnce` on `r2UploadMock` BEFORE invoking the route.
 */
export function resetR2Mock(): void {
  hoisted.upload.mockReset();
  hoisted.upload.mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({
      success: true,
      file: {
        id: 'mock-r2-id',
        key: 'mock/key.png',
        url: 'https://cdn.polsia.com/mock/key.png',
        filename: 'avatar.png',
        mime_type: 'image/png',
        size: 1024,
        created_at: '2026-07-31T00:00:00Z',
      },
    }),
    text: async () => '',
  });
}
