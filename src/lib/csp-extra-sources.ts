// Kept out of next.user-config.ts so the edge proxy does not import
// next-intl/plugin (and its WASM extractor) into the proxy graph.
import type { CspExtraSources } from './csp';

/**
 * Extra Content-Security-Policy source allow-lists, appended to the locked base
 * policy (proxy.ts). Default: all EMPTY (same-origin only). List the EXACT
 * third-party origins a feature needs — never a bare `*` (wildcards and
 * script/style execution escapes are dropped). script-src and style-src are
 * intentionally NOT configurable here: the strict script-src is the XSS rampart,
 * locked by tests/unit/csp.test.ts.
 *   frameSrc   → third-party <iframe> (Stripe, YouTube, reCAPTCHA, Calendly, maps)
 *   connectSrc → fetch/XHR/WebSocket/SSE to other origins (Supabase, Sentry, APIs)
 *   mediaSrc   → <audio>/<video> loaded from other origins
 *   fontSrc    → web fonts from other origins (next/font self-hosts, so rare)
 *   imgSrc     → images beyond the base `https:` allowance (rare)
 * e.g. { frameSrc: ['https://js.stripe.com'], connectSrc: ['https://*.supabase.co'] }
 */
export const cspExtraSources: CspExtraSources = {
  frameSrc: [],
  connectSrc: [],
  mediaSrc: [],
  fontSrc: [],
  imgSrc: [],
};
