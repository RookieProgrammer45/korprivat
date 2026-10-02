// Same-origin post-auth redirect helper shared by login, signup, and OAuth.

const AUTH_NEXT_STORAGE_KEY = 'dlu_auth_next';

/** Reject open redirects: only same-origin relative paths. */
export function sanitizeNext(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  if (!raw.startsWith('/')) return undefined;
  if (raw.startsWith('//')) return undefined;
  return raw;
}

export function signupHrefWithNext(next: string | undefined): string {
  return next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
}

export function loginHrefWithNext(next: string | undefined): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

/** Persist return path across email-verify round-trips (verify drops query). */
export function persistAuthNext(next: string | undefined): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeNext(next);
  if (safe) {
    sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, safe);
  }
}

export function readPersistedAuthNext(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return sanitizeNext(sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY));
}

export function clearPersistedAuthNext(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
}
