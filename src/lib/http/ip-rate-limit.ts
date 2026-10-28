// In-process token bucket for public POSTs. Per instance, not a global
// quota — enough to stop casual abuse on contact, waitlist, consent, and AI.

type Bucket = { count: number; windowStartMs: number };

const buckets = new Map<string, Bucket>();

export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'anonymous';
}

export function takeIpToken(
  key: string,
  options: { windowMs?: number; max?: number } = {},
): { ok: true } | { ok: false; retryAfterSec: number } {
  const windowMs = options.windowMs ?? 10 * 60 * 1000;
  const max = options.max ?? 5;
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStartMs > windowMs) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return { ok: true };
  }
  if (existing.count >= max) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((windowMs - (now - existing.windowStartMs)) / 1000)),
    };
  }
  existing.count += 1;
  return { ok: true };
}

export function resetIpRateLimitForTests(): void {
  buckets.clear();
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return Response.json(
    { errors: { form: 'Too many requests — please try again later.' } },
    { status: 429, headers: { 'retry-after': String(retryAfterSec) } },
  );
}
