//
// The /api/auth/welcome route calls
//   POST https://polsia.com/api/proxy/email/contacts
// to register the new user as a known contact (so the welcome send escapes
// the cold-outreach tier). In tests we want to confirm the wire body shape
// WITHOUT a network round trip — the global fetch is swapped for a router
// serving canned `{ ok: true }` responses, and the call list is recorded.
//
// biome: this helper sits under `tests/integration/_setup/` outside the
// overrides' src/** glob so biome's default rule set applies; the import
// statements don't touch restricted paths.

import { vi } from 'vitest';

export interface ContactsMockFixture {
  restore: () => void;
  calls: Array<{ url: string; method: string; body: unknown }>;
}

/**
 * Replace globalThis.fetch with a stub that:
 *   - routes POST https://polsia.com/api/proxy/email/contacts → { ok: true }
 *   - records every call so tests can assert source/email/name
 *
 * Falls back to the original fetch for any other URL so unrelated callers
 * still hit the network if they ever do.
 *
 * Usage:
 *   const contacts = installContactsProxy();
 *   await import('@/app/api/auth/welcome/route');
 *   ...
 *   contacts.restore();
 */
export function installContactsProxy(): ContactsMockFixture {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    let parsedBody: unknown = null;
    if (init?.body) {
      try {
        parsedBody = JSON.parse(typeof init.body === 'string' ? init.body : '');
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({ url, method, body: parsedBody });

    if (url.endsWith('/api/proxy/email/contacts')) {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    // Untouched routes fall through; in practice nothing else in the welcome
    // route needs network.
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    calls,
  };
}
