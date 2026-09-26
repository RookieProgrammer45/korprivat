# Decisions

## ADR-000: Reconciliation baseline

**Date:** 2026-09-26
**Status:** Accepted
**Context:** The repo is a Polsia migration with a working Swedish
marketplace (SEK, HANDLEDARE, better-auth, Didit age estimation). The
architecture docs assumed a UK greenfield. This ADR records the
reconciliation so future sessions don't re-open closed questions.

**Decisions:**
1. Target market: Sweden-first. SEK. HANDLEDARE is a first-class role.
2. Auth: better-auth stays. Docs updated.
3. Verification: age estimation for learners, ID verification for
   instructors. Guardian consent becomes handledare enrollment.
4. Booking: migrate existing table in place; add exclusion constraint.
5. Polsia: strip framework-owned comments; take ownership.
6. Directory: src/lib/<context>/. Routes stay as /dashboard/{role}.
7. Fee model: current 0% / 10% SEK stays. School payouts deferred.

**Consequences:**
- docs/architecture.md §5, §6, §7.2 must be rewritten for Sweden.
- docs/learner-verification-flow.md needs a Swedish variant.
- AGENTS.md is updated to match the repo, not the other way around.

**Alternatives rejected:**
- Migrate code to match docs → rejected: would rebuild a working product.
- Run both models in parallel → rejected: guaranteed drift.

## ADR-003: Canonical webhook host is www.drivelinkup.com

**Date:** 2026-09-26
**Status:** Accepted
**Context:** The apex domain `drivelinkup.com` issues a 308 permanent
redirect to `www.drivelinkup.com` at the Vercel edge. HTTP clients
that don't preserve POST bodies across 308 will deliver an empty body
to the redirected URL, causing signature verification to fail.

**Decision:** All inbound webhook destinations target the www host.
The apex is reserved for browser traffic, which handles the redirect
fine.

**Consequences:**
- Didit destination URL updated to www.
- Any future webhook provider must use www.
- Documented in AGENTS.md.

**Alternatives rejected:**
- Remove the apex redirect: affects every page, too broad a change
  for a webhook fix.
- Rely on 308 body preservation: not guaranteed by the HTTP spec for
  all clients.

