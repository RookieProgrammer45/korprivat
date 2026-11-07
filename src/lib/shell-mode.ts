/**
 * Route → chrome mode. Root layout always mounts SiteNav/SiteFooter; focused
 * app flows (auth, onboarding, dashboard, listing wizard) supply their own
 * chrome and must suppress the marketing shell.
 */

import { parseLocalePrefix } from '@/lib/seo/locale-path';

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
  const path = parseLocalePrefix(pathname).pathname;
  if (FOCUSED_EXACT.has(path)) return 'focused';
  if (FOCUSED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) {
    return 'focused';
  }
  return 'marketing';
}

export function isFocusedShellPath(pathname: string | null | undefined): boolean {
  return shellModeForPath(pathname) === 'focused';
}
