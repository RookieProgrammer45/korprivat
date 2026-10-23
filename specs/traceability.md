# Traceability — Plan v5 → Spec Pack

## Platform Specification v1.2 (specs/09) — the implementation authority

`specs/09-scalable-platform-specification.md` consolidates this pack and the Connectivity Program Design into one canonical document. Its §16 maps every earlier requirement to a section inside it; where it conflicts with the files below, specs 09 wins. The files below remain the detail-of-record (test series BK/VF/UX/CN/API, deeper data-model and workflow detail).

| specs/09 section | Consolidates |
|---|---|
| §1 Baseline & migration | 02 (migration rules) + live-repo verification (Oct 2026) |
| §2–§4 Thesis, goals, modes | 00, 03 §3 |
| §5 Authorization model | 02 (school_authorizations), 03 §3 |
| §6 Booking engine | 03 §1–§9 |
| §7 Connectivity API | 05 + Connectivity Program Design v0.1 §4 |
| §8 Partner lifecycle | 05 §3 + Program Design §5–§6 |
| §9–§10 Domains, markets | 00, 04, 06 |
| §11 Data model | 02 + live-repo entity verification |
| §13 Build sequence | 07 (Phase 0 unchanged: repository discovery first) |
| §15 SC-1…20 | 03 (BK), 04 (VF), 08 (API) consolidated |
| Appendix A | 04 §9 (VF-a…j2, verbatim) |
| Appendix B | 08 (API-1…9, expanded) |

Every requirement below has one canonical spec location and an acceptance hook. Dependencies marked ⛔ are blocked on external access (do not fake). The full §8.7 release-test paragraph (a, a2, a3, a4, b, c, c2, d, e, f, g, h, i, j, j2) was recovered in full from the plan and is covered in spec 04 §9 — nothing truncated.

## Plan §2 audit defects

| Defect | Spec | Acceptance |
|---|---|---|
| B1 external checkout unverified | 03 §1–§2 | BK-2; pending-until-authoritative; non-destructive migration rule (02; 07 Phase 1) |
| B2 claim-practice gap | 04 §10; 06 §3 | badges render only from stored evidence (date + method); homepage/FAQ copy matches practice |
| B3 instructor criterion | 04 §11; 02 instructor_profiles; 06 §5 | "körkort 5 år" criterion removed from signup; instructor onboarding requires affiliation + individual approval where rules require both (Sweden: yes); E2 blocks unapproved instructors |
| B4 review rights | 06 §2 | third-party review content not rendered until rights basis documented; transaction-verified reviews as replacement |
| B5 i18n raw keys | 06 §2 | UX-2 |
| B6 partial availability | 03 §3 | BK-1; UX-1 |

## Plan §7 booking model

| Requirement | Spec | Acceptance |
|---|---|---|
| Canonical policy service (E0–E4, action-specific) | 03 §1 | BK-5 (E1 fails at acceptance), BK-5b (manual acceptance needs no connector), BK-14 (E0 saleability bypass closed); applied at activation, submission, creation, acceptance, confirmation, rescheduling |
| Booking ownership authorization | 08 §5 (canonical) | API-4 (foreign student/school → 403, no changes) |
| Resource-bundle contract (duration, permitted location, required_resources, server-side assignment, atomic bundle hold) | 02 offerings; 08 §5 create | API-5; BK-15 (no partial hold) |
| Resource-conflict enforcement (resource + interval + buffers + holds, cross-mode) | 02 (canonical rule); 03 §6 | BK-3b (two allocations, same resource) |
| origin + ingestion_method + external_ref | 02 bookings; 03 §5 | BK-10; import never charges |
| Migration/backfill (non-destructive) | 02; 07 Phase 1 | terminal states + financial history preserved; unknown provenance marked unverified; no new charges/commissions |
| Six capability flags; UI gates instant booking | 02 school_capabilities; 03 §3 | BK-1; allocation/native invariants (accepted_at, workspace onboarding) |
| Fallback ladder instant→request→contact | 03 §3 | BK-1 |
| Native + allocation operational workflows (incl. system confirmation; allocation-diary acknowledgment rule) | 03 §7 | BK-11 (local instant confirmation); BK-13 (diary acknowledgment) |
| Reconciliation + authoritative-state comparison | 03 §9; 05 §2 (getAuthoritativeState) | drift reported, never auto-overwrites |
| Earnings from authoritative records only | 03 §8; 06 §6 | earnings_entries.source invariant |
| Widget attribution/pricing consistency | 03 §5, §8; 06 §7 | R9 gate: pricing/terms updated first; server-side token attribution (BK-10) |
| Refund/commission policy | 03 §5 | explicit commercial gate recorded in ARCHITECTURE-NOTES (documented-or-blocked) before implementation |

## Plan §8 verification architecture

| Requirement | Spec | Acceptance |
|---|---|---|
| Claim-to-evidence table (SE) | 04 §1 | — |
| Bolagsverket signing modes | 04 §1 | VF-a, VF-a2, VF-a3, VF-a4 |
| Official-source matrix (Nordics/UK, URLs inline) | 04 §2 | — |
| e-ID broker shortlist | 04 §3 | sandbox tests (future, ⛔ vendor choice) |
| Student e-ID optional; guardian flows | 04 §7; 06 §2 | VF-b, VF-g |
| Exception-based doc verification | 04 §5 | VF-f (default path); temporary-collection workflow states explicit |
| Role table | 00 actors; 02 memberships + platform_admins | school-scoped roles; admin authorization separate |
| verification_records schema | 02 | VF-c2 |
| Permission-gating rules | 04 §4 | VF-c, VF-c2, VF-d; UX-3/UX-3b (expired → disabled) |
| Release tests (a)–(j2), complete list | 04 §9 | VF-a…VF-j2 (all 15) |
| PRH coverage gap → manual review | 04 §9 | VF-h |
| FI instructor permit positive evidence | 04 §9 | VF-i |
| DK documentary + aktindsigt positive confirmation | 04 §9 | VF-j |
| FI autokoululupa positive confirmation | 04 §9 | VF-j2 |
| Skatturinn permitted-use confirmation | 04 §2 | Iceland launch gate ⛔ |

## Plan §5–§6 connectors

| Requirement | Spec | Acceptance |
|---|---|---|
| Calendar tier (Google/Graph, verified scopes) | 05 §7 | CN-3; NN5; least-privilege scope selection as adapter configuration gate |
| Channel/subscription renewal | 05 §7 | renewal jobs |
| Five-milestone chain | 05 §3 | CN-1 (mock passes ≠ milestone evidence) |
| Failure tests (concurrency, dupes, atomicity, expiry, revocation) | 05 §5 | milestone-4 tests 1–5 against vendor test env |
| Event ordering (stable IDs, revision, watermark = latest accepted authoritative transition using provider revision/occurrence time — never local timestamps, resync) | 05 §4; 02 booking_events | CN-4 / BK-7 / BK-12 (equal or missing ordering data → authoritative-state retrieval, no guess) |
| Dual-connection external_ref scoping | 02 bookings (school_connection-scoped unique); 05 §4 | CN-5 |
| Vendor-neutral onboarding | 05 §8 | CN-3 |
| No TABS-Sweden adapter; no NO sunset extension | 05 §1 | build exclusion |
| Slots unranked; Optima agreement ≠ Smart evidence | 05 §1 | — |
| Outreach questions/milestone state | 05 §1, §3 | ledger in plan v5 |

## Plan §9 growth

| Requirement | Spec | Acceptance |
|---|---|---|
| Widget (R9) | 06 §7; 03 §5 | pricing-gate check; server-side provenance (BK-10) |
| Cancellation-slot alerts (R8) | 06 §7 | explicit consent; cooldown prevents duplicate alerts; rebooking re-validates the instant-booking policy checks |
| Referrals | 06 §7 | capped, attributable |
| Growth metrics (activation rate, bookable hours, fulfilment, failures/100, retention, support minutes, R8 funnel, widget attribution; contribution per the 06 §8 platform-only definition) | 06 §8 (canonical definitions + recorded events) | each metric has definition + event source; instrumentation built with its phase |

## School-authorization and representation (from the Sjöbotrafikskola complaint, October 2026 — [OBSERVED customer communication])

| Requirement | Spec | Acceptance |
|---|---|---|
| School authorization model (scopes: availability_display, inquiry_collection, request_to_book, transactional_booking, payment_collection; directory-only default) | 02 school_authorizations; 03 §3 | BK-17 (withdrawal blocks server-side), BK-19 (no auto-enable), API-7, UX-4 |
| Withdrawal persistence across data refresh | 02; 03 §3 | BK-18 |
| Recipient clarity (DriveLinkUp identified as form recipient) | 06 §2 | UX-5 |
| Payment clarity (who receives payment; when confirmed) | 06 §2 | — |
| Brand representation (identification only; no implied partnership) | 06 §2 | — |
| School-controlled cancellation policy (versioned, business-day calendars, snapshot per booking) | 02 cancellation_policies; 03 §3; 06 §2 | BK-20 (13:00-previous-business-day ≠ 24h) |
| School-complaints workflow (record → suspend → verify → fresh authorization to re-enable) | 06 §8 | ops task + audit |
| Directory-only profile (info + prices; no times/form/contact-as-booking) | 03 §3; 06 §2 | UX-4 |
| **Scope-specific withdrawal** (removing one scope leaves others; re-check at acceptance/confirmation; never blocks cancellation/refunds of existing bookings) | 03 §3 (action-to-scope mapping) | BK-17, BK-21 |
| Staff may suspend/withdraw only; grants/restoration require fresh evidence from a server-side-identified school representative | 08 §4 authorizations | API-7 |
| Cancellation-policy snapshot per booking + unresolved-policy outcome (no checkout, no fallback policy) | 02 bookings + cancellation_policies; 08 §5 | BK-20 (conditional on approved calendar) |
| Brand assets (logos) require separate rights basis beyond display consent | 06 §2 | — |
| **Acceptance fixture (this school, current state):** information and prices allowed; NO times, booking, inquiry/contact module, or payment entry point; future reconsideration recorded as a note — not present authorization | 03 §3; 06 §8 | BK-17/BK-19 + ops task |
| Integration-accuracy separation (school's internal platform ≠ vendor integration route) | 05 §1, §8 | two separate gates |

## Plan §10 backlog R1–R11 → Delivery plan

| Epic | Phase | Notes |
|---|---|---|
| R1 fix defects | Phase 1 | incl. non-destructive migration/backfill acceptance |
| R2 flags + booking model | Phase 1 | policy service with action-specific checks, mocks |
| R3 vendor-neutral onboarding | Phase 3 | |
| R4 Swedish connector investigations | Phase 4 (mocks) | ⛔ real connectors (agreement) |
| R5 calendar tier | Phase 3 | |
| R6 verification split a–f | Phase 2 | ⛔ real register APIs |
| R7 reconciliation + failure tests | Phase 4 | |
| R8 alerts | Phase 5 | |
| R9 widget | Phase 5 | pricing gate; server-side provenance |
| R10 next-market comparison | Phase 6 | research deliverable |
| R11 register maintenance | Phase 6 | research deliverable |

## Legal and policy gates (retain — not buildable, not skippable)

- P2B/DSA trader-verification applicability and GDPR lawful basis per check (counsel).
- Guardian-consent relationship/authority rules per market (counsel-reviewed).
- Provider-onboarding vs DriveLinkUp's own trader-verification mapping (counsel).
- Per-market eligibility rules resolve to a market-config value marked approved-documented or blocked (07 Phase 0); unresolved rules fail closed **with the failure kind explicit** (03 §1: eligibility-block vs route-downgrade), never invented.
- Activation requires onboarding-gate checks (representative identity, company match, signatory outcome) — 08 §1 activate.

## Blocked items (⛔)

Vendor connectors (agreement), Bolagsverket paid tier + most register APIs (production access), Denmark/Finland/Iceland launches (permit-disclosure routes; Skatturinn confirmation), payment provider (architecture decision).
