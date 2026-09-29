import 'server-only';
import Stripe from 'stripe';

if (!process.env.STRIPE_SECRET_KEY) {
  // Lazily fail on first use via getters below — env validation at route time
  // keeps typecheck / seed scripts from exploding when Stripe is unset.
}

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  if (!_stripe) {
    _stripe = new Stripe(key, {
      // stripe@22 types pin LatestApiVersion; pin explicitly to that release.
      apiVersion: '2026-08-26.dahlia',
    });
  }
  return _stripe;
}

/** Prefer importing `getStripe()`; `stripe` is a lazy proxy for call-site ergonomics. */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const client = getStripe();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});
