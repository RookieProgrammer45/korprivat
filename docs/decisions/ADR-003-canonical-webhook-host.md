# ADR-003: Canonical webhook host is www.drivelinkup.com

## Status
Accepted

## Date
2026-09-26

## Context
The apex domain `drivelinkup.com` issues a 308 permanent redirect to
`www.drivelinkup.com` at the Vercel edge. HTTP clients that don't
preserve POST bodies across 308 will deliver an empty body to the
redirected URL, causing signature verification to fail.

Production observation (2026-09-26):
`https://drivelinkup.com/api/webhooks/didit` → 308 →
`https://www.drivelinkup.com/api/webhooks/didit`. The Didit destination
was updated to the www host; www returns 401 (signature gate live).

## Decision
All inbound webhook destinations target **`https://www.drivelinkup.com`**.
The apex is reserved for browser traffic, which handles the redirect fine.

## Alternatives Considered

### Remove the apex → www redirect
- Pros: Apex and www both accept POST webhooks.
- Cons: Affects every page and SEO/canonical setup; too broad for a
  webhook delivery fix.
- Rejected.

### Rely on 308 body preservation
- Pros: No destination URL change.
- Cons: Not guaranteed by the HTTP spec for all clients; Didit (and
  Stripe later) may drop the body and fail HMAC verification.
- Rejected.

## Consequences
- Didit destination URL updated to www (2026-09-26).
- Any future webhook provider (Stripe Connect, etc.) must use www.
- Documented in `AGENTS.md` under Canonical webhook host.
