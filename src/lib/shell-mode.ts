/**
 * Route → chrome mode. Root layout always mounts SiteNav/SiteFooter; focused
 * app flows (auth, onboarding, dashboard, listing wizard) supply their own
 * chrome and must suppress the marketing shell.
 */

export type ShellMode = 'marketing' | 'focused';

const FOCUSED_EXACT = new Set(['/instructors/new', '/profile']);

const FOCUSED_PREFIXES = [
  '/dashboard',
  '/onboarding',
  '/signup',
  '/login',
  '/oauth-complete',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  '/instructors/new/',
] as const;

export function shellModeForPath(pathname: string | null | undefined): ShellMode {
  if (!pathname) return 'marketing';
  if (FOCUSED_EXACT.has(pathname)) return 'focused';
  if (FOCUSED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix))) {
    return 'focused';
  }
  return 'marketing';
}

export function isFocusedShellPath(pathname: string | null | undefined): boolean {
  return shellModeForPath(pathname) === 'focused';
}
