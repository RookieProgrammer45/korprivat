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
