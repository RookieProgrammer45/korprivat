// routes. Mirrors the inline helper in /api/subscription/checkout, hoisted here
// so all booking routes — checkout (Stripe success/cancel URLs), payment-poll
// (receipt email deep-links) — share a single seam.
//
// Prefer Origin / forwarded host over `new URL(req.url).origin` so
// success/cancel and receipt links use the public app URL.
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
