//
// The stripe-billing module talks to Polsia's billing API via the global
// fetch. In tests we want to serve canned responses for
//   POST /api/v2/app-payments/checkout-session   → CheckoutSessionResult
//   GET  /api/company-payments/verify            → CheckoutVerificationResult
//   POST /api/v2/app-payments/events            → PaymentEventsResult (unused here)
// without touching a network. This helper swaps globalThis.fetch for a
// tiny router that records every call and returns the canned body.
//
// Why we don't vi.mock('@/lib/stripe-billing/client') instead:
//   - The plan specifically asks the suite to confirm the wire format
//     (polsiaJson path). Mocking the client hides the request envelope;
//     mocking fetch exercises it.
//   - The client module is framework_owned — vi.mock can still target it
//     (vitest redirects imports), but the fetch-replacement gives every
//     test full visibility into what the module actually sent.
//
// biome: this helper is a TEST file under `tests/integration/**`. It's
// outside the override paths so biome's default rule set applies; it does
// not import any restricted paths itself.

import { vi } from 'vitest';

type ResponseMap = Map<string, (init: { method: string; body: unknown }) => Promise<Response>>;

export interface StripeProxyFixture {
  restore: () => void;
  setResponse: (
    key: string,
    handler: (init: { method: string; body: unknown }) => Promise<unknown> | unknown,
  ) => void;
  setRawResponse: (key: string, response: Response) => void;
  calls: Array<{ url: string; method: string; body: unknown }>;
}

const DEFAULT_RESPONSES: ResponseMap = new Map();

/**
 * Replace globalThis.fetch with a router that serves canned responses
 * keyed by `method path` (e.g. `'POST /api/v2/app-payments/checkout-session'`).
 *
 * Usage:
 *   const stripe = installStripeProxy();
 *   stripe.setResponse('POST /api/v2/app-payments/checkout-session', async ({ body }) => ({
 *     id: 1, stripeSessionId: 'cs_test_abc', url: 'https://stripe.test/cs_test_abc',
 *     totalAmountUsd: 52, companyReceives: 49, platformFee: 3,
 *   }));
 *
 *   await import('@/app/api/bookings/[id]/payment-link/route');
 *   ...
 *
 *   stripe.restore();
 */
export function installStripeProxy(): StripeProxyFixture {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const responses: ResponseMap = new Map();
  const rawOverrides: Map<string, Response> = new Map();
  const originalFetch = globalThis.fetch;

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? 'GET').toUpperCase();
    let parsedBody: unknown = null;
    if (init?.body) {
      try {
        parsedBody = JSON.parse(typeof init.body === 'string' ? init.body : '');
      } catch {
        parsedBody = init.body;
      }
    }
    calls.push({ url, method, body: parsedBody });
    const key = `${method} ${new URL(url).pathname}`;
    const raw = rawOverrides.get(key);
    if (raw) return raw.clone();
    const handler = responses.get(key) ?? DEFAULT_RESPONSES.get(key);
    if (!handler) {
      return new Response(JSON.stringify({ error: `no stub for ${key}` }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    const value = await handler({ method, body: parsedBody });
    return new Response(typeof value === 'string' ? value : JSON.stringify(value), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return {
    restore: () => {
      globalThis.fetch = originalFetch;
    },
    setResponse: (key, handler) => {
      responses.set(key, async (init) => {
        const value = await handler(init);
        return value as Response;
      });
    },
    setRawResponse: (key, response) => {
      rawOverrides.set(key, response);
    },
    calls,
  };
}

/** Canned response for POST /api/v2/app-payments/checkout-session.
 *  Mirrors the wire shape the stripe-billing client expects:
 *  outer { checkout_session: { id, stripe_session_id, url, total_amount_usd,
 *    company_receives, platform_fee, … } } */
export function checkoutSessionResponse(input: {
  sessionId?: string;
  url?: string;
  amountUsd: number;
}): Record<string, unknown> {
  const sessionId = input.sessionId ?? `cs_test_${Math.random().toString(36).slice(2, 10)}`;
  const url = input.url ?? `https://stripe.test/c/${sessionId}`;
  return {
    checkout_session: {
      id: 1,
      stripe_session_id: sessionId,
      url,
      total_amount_usd: input.amountUsd,
      company_receives: Math.floor(input.amountUsd * 0.95),
      platform_fee: Math.ceil(input.amountUsd * 0.05),
    },
  };
}

/** Canned response for GET /api/company-payments/verify. */
export function verifyCheckoutResponse(input: { verified: boolean }): Record<string, unknown> {
  if (!input.verified) return { verified: false };
  return {
    verified: true,
    payment: {
      amount_usd: 52,
      customer_email: 'learner@example.test',
      product_name: 'Betala lektionen',
      paid_at: '2026-08-10T14:30:00.000Z',
    },
  };
}
