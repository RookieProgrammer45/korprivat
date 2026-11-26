// Applied only when the deploy is indexable (SEO_INDEXABLE).
export const robotsConfig = {
  /** Paths to keep out of search even when indexable, e.g. ['/admin']. */
  disallow: [
    '/dashboard',
    '/admin',
    '/api/',
    '/checkout',
    '/bookings',
    '/profile',
    '/instructors',
    '/tung-trafik',
    '/login',
    '/signup',
  ] as string[],
  /** Optional crawl-delay (seconds) for the default user-agent. */
  crawlDelay: undefined as number | undefined,
};
