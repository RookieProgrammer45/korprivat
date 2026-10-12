// Same-origin post-auth redirect helper shared by login, signup, and OAuth.

const AUTH_NEXT_STORAGE_KEY = 'dlu_auth_next';
const AUTH_REDIRECT_ORIGIN = 'https://auth.drivelinkup.invalid';

/** Reject open redirects: only same-origin relative paths. */
export function sanitizeNext(raw: string | null | undefined): string | undefined {
  if (!raw || !raw.startsWith('/')) return undefined;
  try {
    // Reject encoded protocol-relative and backslash variants too. Browsers
    // treat a backslash as a path separator when resolving a URL.
    const decoded = decodeURIComponent(raw);
    if (!decoded.startsWith('/') || decoded.startsWith('//') || decoded.startsWith('/\\')) {
      return undefined;
    }
    return new URL(raw, AUTH_REDIRECT_ORIGIN).origin === AUTH_REDIRECT_ORIGIN ? raw : undefined;
  } catch {
    return undefined;
  }
}

export function signupHrefWithNext(next: string | undefined): string {
  return next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';
}

export function loginHrefWithNext(next: string | undefined): string {
  return next ? `/login?next=${encodeURIComponent(next)}` : '/login';
}

export function forgotPasswordHrefWithNext(next: string | undefined): string {
  const safe = sanitizeNext(next);
  return safe ? `/forgot-password?next=${encodeURIComponent(safe)}` : '/forgot-password';
}

export function resetPasswordHrefWithNext(next: string | undefined): string {
  const safe = sanitizeNext(next);
  return safe ? `/reset-password?next=${encodeURIComponent(safe)}` : '/reset-password';
}

/**
 * Extract a recovery return path only from our own reset callback URL.
 * Better Auth supplies this URL from requestPasswordReset's redirectTo; the
 * email hook must not trust it until both its origin and route are checked.
 */
export function recoveryNextFromCallbackURL(
  callbackURL: string | null | undefined,
  siteURL: string,
): string | undefined {
  if (!callbackURL) return undefined;
  try {
    const callback = new URL(callbackURL);
    if (callback.origin !== new URL(siteURL).origin || callback.pathname !== '/reset-password') {
      return undefined;
    }
    return sanitizeNext(callback.searchParams.get('next'));
  } catch {
    return undefined;
  }
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
