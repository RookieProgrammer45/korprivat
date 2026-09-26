// @polsia:user-owned — Next.js 16 edge proxy for DriveLinkUp (replaces middleware.ts).
//
// Do NOT create `middleware.ts`. This file owns:
//   - CSP with per-request nonce
//   - frame-ancestors 'none'
//   - Optional edge checks (compose carefully; prefer page/API guards for auth)
//
// CSP is built in `src/lib/csp.ts`: script-src stays strict (nonce +
// 'strict-dynamic'). style-src allows 'unsafe-inline' for Radix/shadcn.
// Posture locked by tests/unit/csp.test.ts.

import { type NextRequest, NextResponse } from 'next/server';
import { buildCsp } from '@/lib/csp';
import { cspExtraSources } from '@/lib/csp-extra-sources';

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  // Edge contributions (rate-limit, etc.) may be added here intentionally.
  // Auth / verification redirects stay in src/lib/dashboard-guard.ts and
  // signup-resume — not in this file unless there is a clear edge need.

  const csp = buildCsp(nonce, isDev, process.env.NEXT_PUBLIC_API_URL ?? '', cspExtraSources);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
