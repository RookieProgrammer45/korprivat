// Thin error reporting seam for Didit / payments / cron / orgs.
// When @sentry/nextjs is installed and SENTRY_DSN is set, extend this
// function to call Sentry.captureException — keep the console path too.

import 'server-only';

export async function reportError(
  error: unknown,
  context?: { tags?: Record<string, string>; extra?: Record<string, unknown> },
): Promise<void> {
  console.error('[observability]', {
    tags: context?.tags ?? {},
    extra: context?.extra ?? {},
    sentryDsnConfigured: Boolean(process.env.SENTRY_DSN?.trim()),
    error,
  });
}
