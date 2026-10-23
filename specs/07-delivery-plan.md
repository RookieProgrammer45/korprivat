# 07 — Delivery Plan (build order, acceptance, bounded Cursor prompts)

**Req ID prefix:** DP. Maps plan backlog R1–R11 to buildable phases. No phase depends on vendor access except where marked.

## Phase 0 — Gate 0: repository discovery
- Inventory the live-MVP repo; write `specs/ARCHITECTURE-NOTES.md` (spec 01). Record explicit commercial/legal-gate decisions there too: refund-commission policy (spec 03 §5), multi-currency policy, and the per-market eligibility-rules configuration (spec 04). **Cursor can document decisions and mark unresolved ones as blocked configuration — it cannot approve legal or commercial policy itself.** An unresolved rule fails **closed, with the failure kind explicit** (spec 03 §1): an unresolved **eligibility/permission** rule blocks the affected booking action entirely (review/contact modes only); a missing **instant control route** downgrades to request-to-book where the request-path checks pass. Never invent a rule.
- **Acceptance:** every subsequent [PROPOSED] item has a concrete translation note; a Swedish market config exists with each rule marked approved-documented or blocked-explicitly.
- **Prompt to Cursor:** "Read the repository and produce specs/ARCHITECTURE-NOTES.md per specs/01-architecture.md Gate 0. Do not change application code."

## Phase 1 — Audit-defect fixes + booking model + school authorization (P0: R1 + R2 + the Sjöbotrafikskola authorization change)
- **P0 (from the Sjöbotrafikskola complaint, October 2026):** school-authorization model (`school_authorizations`, scopes, withdrawal), directory-only mode, recipient/payment clarity, school-controlled versioned cancellation policies (the live "24 hours" default must be migrated to school-confirmed policies or removed — never kept as a platform default), brand-representation rules, and the school-complaints workflow. **Note: these spec changes do not change the live app — the live Sjöbotrafikskola profile must be switched to directory-only as an immediate operational action by the founder.**
- B5 i18n fix; B6 availability display via capability flags; B2 claim alignment (badges from evidence); B3 instructor criterion fix; B4 review-content removal/replacement; B1 external-checkout modeling (pending-until-authoritative).
- Data model: `school_capabilities`, `origin`/`ingestion_method`/`external_ref` on bookings, resources/allocations/holds tables; derived booking mode server-side; fallback ladder; **policy service with action-specific checks (spec 03 §1) with mock verification adapters**.
- **Migration/backfill acceptance (non-destructive — spec 02):** preserve historical booking states, amounts, and payment records; unknown provenance/booking-authority evidence is marked unverified, never invented; existing active schools map to `pending_verification` (future bookability gated, historical transactions untouched); migration tests confirm terminal states and financial history are unchanged and no new charges/commissions are triggered.
- **Acceptance:** BK-1, BK-3, BK-3b, BK-4, BK-5, BK-5b, BK-8 (mock payment), BK-10 (mock widget token), BK-17, BK-18, BK-19, BK-20; VF-c2 with mocks; UX-2, UX-4, UX-5; no "verified" claim without stored evidence in the UI.

## Phase 2 — Verification module (P0: R6, split)
- R6a identity/contact (e-ID broker + Twilio Verify behind feature flags); R6b company & mandate (Bolagsverket modes VF-a…a4; Companies House); R6c school/instructor permission workflow (Transportstyrelsen manual workflow + STR secondary signal); R6d student eligibility + guardian flows; R6e evidence/badge lifecycle (`verification_records`, expiry, re-check scheduler, review queue); R6f exception-based document verification (trigger-only).
- API contracts from spec 08 (onboarding, review queue, activation, recheck).
- **Acceptance:** release tests VF-a…VF-g pass in staging with mock register adapters.

## Phase 3 — Vendor-neutral onboarding + calendar tier (P0/P1: R3 + R5)
- Onboarding flow asks which system; routes to transaction-capable / read-only / calendar-sync / unsupported-with-fallbacks.
- Google freebusy + Microsoft getSchedule as `calendar_sync`; channel/subscription renewal jobs; read vs write scopes separated.
- **Acceptance:** CN-3; calendar-sync school shows request-to-book, never instant (NN5).

## Phase 4 — Connector framework with mocks (P0/P1: R4 + R7)
- Adapter interface + event ingestion + dedupe + milestone state machine (all candidates at milestone ≤1 — dependencies).
- Mock adapters replay: duplicate, out-of-order, stale, revoked-access scenarios.
- **Acceptance:** milestone-4 failure tests 1–5 pass against mocks (spec 05 §5).

## Phase 5 — Growth loops (P1: R8 + R9)
- Widget (gate: pricing/terms attribution statement updated first); cancellation-slot alerts; referrals.
- **Acceptance:** widget bookings carry `origin = school_direct` and 0 kr acquisition commission.

## Phase 6 — Next-market comparison (P2: R10) and register maintenance (P2: R11)
- Denmark (Just Driving API claim), Norway (LGD TABS), Netherlands (PlanGo), UK compared on verified access + coverage; decision documented with evidence levels.
- Research register rows (NL/FR/ES/IT/PL verification routes; DE Land-law mapping; 18 unresearched countries) completed before any launch planning.

## Blocked-by-external-access items (do not fake)

| Item | Gate |
|---|---|
| Real Bolagsverket/Brreg/CVR/PRH/Skatturinn/Companies House adapters | Register API access (production untested for most) |
| Any real vendor connector | Vendor agreement (milestone 1) → … → milestone 5 |
| Denmark launch | Permit-status disclosure route confirmed (authority inquiry drafted, unsent) |
| Finland launch | School-permit lookup route confirmed |
| Iceland launch | Skatturinn license confirmation + broker support |
| Payment provider onboarding | Payment architecture decision |

## Bounded Cursor prompts (one concern per prompt)

1. "Implement Phase 1 per specs/03-booking-engine.md and specs/02-data-model.md, including the policy service (§1, action-specific checks) and non-destructive migration rules. Server-side derived booking mode; i18n fix. Tests: BK-1, BK-3, BK-3b, BK-4, BK-5, BK-5b, BK-8 (mock payment), BK-10 (mock widget token)."
2. "Implement verification_records + review queue per specs/04-verification-module.md §4 with mock register adapters. Tests: VF-a…VF-g."
3. "Implement the calendar tier per specs/05-connectors.md §7 with renewal jobs. Do not enable instant booking from calendar_sync."
4. "Implement the connector interface + mock adapters per specs/05-connectors.md. Replay failure scenarios 1–5 including the newer-cancellation-then-older-confirmation case (BK-7/CN-4). Mock passes are not milestone evidence (CN-1)."
5. "Implement the API contracts in specs/08-api-contracts.md with mock integrations. Enforce server-side scope on every route (API-1..API-3)."
