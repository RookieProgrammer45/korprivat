// routes. Mirrors the inline helper in /api/subscription/checkout, hoisted here
// so all booking routes — payment-link (Stripe success/cancel URLs), payment-poll
// (receipt email deep-links) — share a single seam.
//
// Behind Polsia's reverse proxy `new URL(req.url).origin` returns the INTERNAL
// bind host (e.g. http://service-container:3000), not the public origin. Stripe
// redirects there and bolts on a `localhost` mimic that breaks the return flow;
// receipt email action links point at the bind host and dead-end the recipient.
// We resolve in this priority: caller `Origin` → forwarded host/proto →
// NEXT_PUBLIC_APP_URL.
import 'server-only';
import { env } from '@/lib/env';

export function resolveOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  if (origin) return origin.replace(/\/+$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) {
    const proto = req.headers.get('x-forwarded-proto') ?? 'https';
    return `${proto}://${host}`;
  }
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
}
