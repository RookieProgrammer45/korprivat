//
// Both the user-owned /api/bookings/me + /api/bookings/instructor routes
// and the better-auth catch-all reach `@/lib/auth.api.getSession` via a
// chain of imports:
//   /api/bookings/me      → require-auth → auth → auth.api.getSession
//   /api/auth/welcome     → auth → auth.api.getSession
//   /api/auth/signup-redirect → auth → auth.api.getSession
//
// Mocking `@/lib/auth` is the smallest hammer that affects every route
// that touches a session, without needing to spin up better-auth.
//
// We register the vi.mock at module load so vitest hoists both the mock
// declaration AND the hoisted vi.fn() to the top of the file — the factory
// closure references the hoisted fn. Tests call setUser()/setNextSession()
// to swap session shape before each case.
//
// biome: restrictedImports is OFF in src/** overrides — we don't need to
// import server-only paths in test code; we just mock the import.

import { vi } from 'vitest';

export interface MockSessionUser {
  id: string;
  email: string;
  name?: string;
  role?: 'user' | 'admin';
  emailVerified?: boolean;
}

interface HoistedState {
  userRef: { current: MockSessionUser | null };
  nextUserRef: { current: MockSessionUser | null };
  getSessionCalls: { value: number };
  getSession: ReturnType<typeof vi.fn>;
}

// vi.hoisted runs before vi.mock factory bodies (both at the very top of
// the file). The shared `getSession` fn + state lets the mock factory and
// tests see the same instance.
const hoisted = vi.hoisted<HoistedState>(() => {
  const userRef: { current: MockSessionUser | null } = { current: null };
  const nextUserRef: { current: MockSessionUser | null } = { current: null };
  const getSessionCalls: { value: number } = { value: 0 };
  const getSession = vi.fn(async () => {
    getSessionCalls.value += 1;
    if (nextUserRef.current !== null) {
      const u = nextUserRef.current;
      nextUserRef.current = null;
      return u
        ? {
            user: { emailVerified: true, ...u },
            session: { id: `sess_${u.id}`, userId: u.id },
          }
        : null;
    }
    const cur = userRef.current;
    return cur
      ? {
          user: { emailVerified: true, ...cur },
          session: { id: `sess_${cur.id}`, userId: cur.id },
        }
      : null;
  });
  return { userRef, nextUserRef, getSessionCalls, getSession };
});

// Register the mock at module-load; `getSession` is the hoisted reference
// so vitest can resolve the factory at hoist time.
vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: hoisted.getSession,
    },
  },
}));

export const authMock = {
  setUser: (user: MockSessionUser | null) => {
    hoisted.userRef.current = user;
  },
  setNextSession: (user: MockSessionUser | null) => {
    hoisted.nextUserRef.current = user;
  },
  callsToGetSession: () => hoisted.getSessionCalls.value,
  reset: () => {
    hoisted.userRef.current = null;
    hoisted.nextUserRef.current = null;
    hoisted.getSessionCalls.value = 0;
    hoisted.getSession.mockClear();
  },
};
