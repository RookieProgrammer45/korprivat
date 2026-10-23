# DriveLinkUp — Scalable Marketplace Product Specification

**Version 1.2 — [PROPOSED].** This document consolidates the earlier DriveLinkUp Cursor spec pack (specs 00–08), the Connectivity Partner Program Design (v0.1), and the verified state of the live application into one canonical, self-contained product specification for build-out. Where this document and the earlier pack overlap, **this document is the implementation authority**; §16 maps every earlier requirement to a section *inside this document*. Essential contracts are reproduced in the body and Appendices A–B.

**Statement kinds:** [OBSERVED-MVP] = verified in the live application; [PROPOSED] = specified here for build; [EXTERNAL] = requires parties or decisions outside the codebase; [VENDOR-REPORTED] = a vendor's own statement, not verified by DriveLinkUp.

---

## 1. Baseline and migration

The live application is a Next.js (App Router) + TypeScript + Prisma + PostgreSQL (Neon) marketplace on Vercel, with next-intl (sv/en), better-auth, Stripe Connect, and per-school listings. [OBSERVED-MVP]

| Capability | State |
|---|---|
| School listings, offerings, availability slots, request/instant booking, i18n parity, claim-aligned copy | [OBSERVED-MVP] live |
| `bookingMode` per school: `instant` \\| `request` \\| `contact` (directory-only; server-side 403s on booking/request/availability publication; owner cannot self-lift `contact`) | [OBSERVED-MVP] — deployed 22–23 Oct 2026 (Sjöbotrafikskola case) |
| Per-scope school authorization, partner registry, Connectivity API, certification workflow, native diary, holds, event inbox/outbox | [PROPOSED] — this document |
| Vendor agreements for any connector | [EXTERNAL] — none signed; TABS AS (Norway) replied 23 Oct 2026: no API integration of the kind requested, none planned near-term [VENDOR-REPORTED] |
| Payment-provider decision (beyond existing Stripe Connect), liability/SLA terms, DK/FI permit-disclosure routes | [EXTERNAL] — unresolved |

**Migration rules (canonical, non-destructive):**

1. Legacy `bookingMode` values are **historical configuration, never authorization evidence**. A legacy `request` school has *not* granted request-to-book; a legacy `instant` value never implies an authoritative booking-control route — the Sjöbotrafikskola case proved a school can be technically `request` while objecting to booking entirely.
2. Affirmative grants are created **only from documented school authorization** (the school's recorded decision, server-side-identified representative).
3. Legacy `contact` maps to an explicit restriction that imports and refreshes cannot lift.
4. Where authorization evidence is absent after migration, **disable the affected new actions** (no booking/inquiry/availability entry points) without deleting listings, financial history, or existing bookings' management paths.
5. Never fabricate verification, permission, or attribution. Unknown historical provenance stays unknown.
6. Existing bookings always retain cancellation, refund, and support paths regardless of any withdrawal.
7. **Migration tests (mandatory):** (a) a legacy `request` school with no authorization evidence renders directory-only, listings and financial history intact, existing bookings manageable; (b) a `contact` school stays restricted through any re-import (SC-14).

## 2. Product thesis: marketplace → platform

Schools run on a handful of national booking systems. The hotel industry solved this with the channel-manager/connectivity-partner model: one published contract, ecosystem-built adapters, certified partners, manual fallback for systemless properties. DriveLinkUp adopts it: **one published integration contract** (§7) that vendors build certified adapters to; **first-party adapters** where vendors permit documented access; an honest **unsupported** classification where neither exists; and a **demand-pull flywheel**. The **school-consent firewall is unchanged**: no connector, certification, or partner status ever implies school consent to book.

**Scalability = four axes (logical requirements on one modular application and database — not multiple services):**

| Axis | Requirement |
|---|---|
| Vendors | Stable adapter contract; certification names product/version/market/capabilities; no vendor-specific logic in booking handlers |
| Schools | Connection-scoped authorization; tenant isolation from authenticated grants (never trusted request IDs); indexed availability; per-connection concurrency control |
| Volume | Durable inbox/outbox, bounded retries, dead-letter handling, backpressure, reconciliation — no booking correctness depends on an in-flight web request |
| Markets | Launch gates (§10), currencies, languages, IANA timezones, school-approved business-day calendars and cancellation rules |

## 3. Goals and non-goals

**Goals:** (1) every eligible school can be listed at an engagement level matching its permissions and capabilities, without double-managed diaries; (2) a vendor can connect schools through one published, versioned contract and reach certified production via a repeatable pipeline; (3) booking correctness is never traded for scale — the final reservation always requires an authoritative conflict check; (4) adding a market, vendor, or school never changes core booking logic; (5) the platform runs with all integrations disabled.

**Non-goals:** becoming schools' operations system; channel-manager breadth beyond driving schools near-term; public partner-program announcements before the first production certification; inventing vendor cooperation, register access, or payment terms.

## 4. Engagement modes (permission × capability, independent scopes)

**Directory eligibility is separate from booking saleability.** A school may be listed (info, prices, reviews) when listing is permitted, information is accurate, rights are respected, and restrictions are honored — **without** completed booking onboarding or active offerings. **E0 (saleability) gates booking actions, never directory visibility.** Verification badges always reflect stored evidence.

Scopes are independent: an inquiry form requires `inquiry_collection` regardless of whether times are shown; displayed times require `availability_display` regardless of booking permissions; a slot picker cannot expose times merely because transactional booking is authorized.

| Surface / action | Required scope | Capability/route prerequisite |
|---|---|---|
| Listing (info, prices, reviews) | listing permission | directory eligibility only (above) |
| Displayed times / availability | `availability_display` | none (display-only) |
| Inquiry form | `inquiry_collection` | none — **inquiry-only with no times is valid** |
| Request-to-book (submission and acceptance) | `request_to_book` | E0–E3; school accepts via its recorded route |
| Instant booking | `transactional_booking` | E0–E4 + authoritative control route |
| Payment collection | `payment_collection` | payment provider decision [EXTERNAL] |

Mode summary: **directory-only** (zero/withdrawn scopes), **authorized inquiry**, **request-to-book**, **instant booking**. Listing eligibility is qualified by school restrictions, accuracy, and brand rights — not universal.

## 5. Authorization model

**Three separate grants, never conflated:** (1) **Partner API credentials** (vendor ↔ platform, environment-scoped); (2) **school-account connection permission**; (3) **school authorization** (public-surface scopes).

Rules: directory visibility and bookability are separate; a working connector, verified permit, school account, or certification never auto-enables booking; **withdrawal is scope-specific**; withdrawal disables affected **new** actions server-side, survives refresh/re-import, and is re-checked at acceptance and confirmation; it never blocks cancellation, refunds, or support for existing confirmed bookings; re-enabling requires fresh affirmative authorization (a future-reconsideration note is not authorization); platform staff may suspend/withdraw from a complaint, but **granting/restoring requires fresh school evidence** from a server-side-identified representative; school commercial authorization is not GDPR consent. Native diary and allocations are safe only for inventory the school genuinely delegates to DriveLinkUp — never a mirror of an inaccessible external diary. Authority is per route: connector routes → vendor system; native/allocation routes → DriveLinkUp.

## 6. Booking engine (canonical rules reproduced)

### 6.1 Policy service — E0–E4, action-specific

One server-side policy service; the UI never re-implements it. Which components apply depends on the **action**:

| Component | Definition |
|---|---|
| E0 (saleability) | School onboarding gates complete (representative identity, company match, signatory outcome), `listing_status='active'`; the offering `active` and not suspended |
| E1 | School teaching permission **current for the offering's legal entity, location, and category** (scope match, not name match) |
| E2 | Instructor permission and school affiliation where rules require both (Sweden: yes) |
| E3 | Student contact verified; lesson eligibility per market rules; guardian consent where the booker is a minor |
| E4 | A **valid control route** for the actual resources: transaction-capable connector (milestone 5), verified allocation (accepted allocation row), or native workspace |

| Action | E0 | E1 | E2 | E3 | E4 |
|---|---|---|---|---|---|
| Offering publication/activation | — | ✓ | ✓ | — | — |
| Request submission | ✓ | ✓ | ✓ | ✓ | — |
| Instant booking creation | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manual request acceptance | ✓ | ✓ (re-evaluated) | ✓ (re-evaluated) | ✓ (re-evaluated) | — (**E4 not required**; school records its commitment route) |
| Confirmation / rescheduling | ✓ | ✓ | ✓ | ✓ | ✓ (instant path) |

Failures return structured per-component errors. Two failure kinds everywhere: **unknown legal eligibility** (E1/E2/E3 unresolved) → blocked action, review/contact surfaces only; **no control route** (E4 absent) → request-to-book remains available where authorized. Manually accepted requests commit resources via the school's chosen route (native allocation, accepted allocation, or recorded `external_manual` commitment); without a route the request stays `pending`.

### 6.2 Booking state machine

States: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `expired`, `no_show`.

| From | To | Trigger | Authorized actor | Effects |
|---|---|---|---|---|
| — | pending | instant creation | student | idempotency key recorded; hold TTL starts |
| — | pending | request submitted | student | no resources held |
| pending | confirmed | request accepted | school/instructor (school-scoped role) | acceptance checks re-evaluated at acceptance; `commitment_route` persisted |
| pending | confirmed | system confirmation (native/allocation instant) | system | policy re-validation + the booking's own valid holds (or its accepted allocation) satisfy E4; holds → assignments atomically with the state change |
| pending | confirmed | authoritative external confirmation event | connector (milestone ≥5) | transition row recorded |
| pending | expired | TTL elapsed | system | holds released — **except where a persisted quarantine applies** (§6.4): inventory tied to an unresolved potentially-committed remote reservation stays unavailable until authoritative reconciliation or an audited resolution; **no booking-state recovery from payment alone** |
| pending | cancelled | cancellation before confirmation | student or school | holds released |
| confirmed | in_progress | lesson start | system/school | — |
| in_progress | completed | completion record | school | commission eligible |
| confirmed/in_progress | cancelled | cancellation | per cancellation-tier policy | refund route per policy; resources released |
| confirmed | no_show | school records no-show | school/instructor | per policy |

No `cancelled → no_show` transition. `expired` is terminal; a late payment never resurrects it.

**Ownership authorization (canonical, all booking mutations):** students may mutate only bookings where `booking.student_id` = caller; school users require an authorized membership role in that booking's school; instructors act via their school-scoped membership; cancellation-policy eligibility is evaluated **after** ownership authorization and never substitutes for it. Failures: `403 not_booking_owner` with no state, resource, hold, or payment changes.

### 6.3 Payment, commission, concurrency

- `payment_state` (none/authorized/captured/refunded/voided/disputed) derives **only from authoritative payment records**; never from UI or vendor marketing.
- **Late payment after expiry:** no auto-confirm. Booking stays `expired`; the payment record is flagged `late_captured`; an ops task offers exactly two resolutions — void/refund, or (only if resources are free and instant-booking checks pass) a **new booking**. Currency is explicit per booking and payment; minor units; no inference.
- **Commission:** only `completed` triggers commission; `origin = school_direct` (widget) → 0 kr acquisition commission; attribution is server-side from trusted provenance (registered origin token), never client-controlled; `ingestion_method` never affects commission; refunds reverse commission per the authoritative refund record (pro-rata vs full clawback is an explicit commercial gate — record the decision before implementing). The commission rate is internal and must not appear in partner-facing artifacts.
- **Resource conflicts:** enforced per resource + occupied interval (including buffers and active holds), **across modes**. Allocation-backed bookings: DB exclusion constraint on the allocation window. Rescheduling: release + reserve **atomically** in one transaction, eligibility re-validated; `external_manual` commitments are recorded, not simulated.
- **Connector-route rescheduling (atomic replacement, explicit):** connector routes support rescheduling **only** via the vendor adapter's atomic swap operation (`/adapter/reservations/{ref}/reschedule`, §7.2), which releases the old bundle and holds/commits the new one in one vendor-side operation returning both outcomes. This is a **separately certified capability** (§8): without it, connector-route bookings are cancelled and rebooked — never sequentially released-then-reserved, which is not an atomic remote swap.

### 6.4 Reliability architecture (volume axis)

- **Durable inbox:** every inbound partner event lands in `booking_events` (`provider_event_id`, `occurred_at`, `received_at`, `processing_status: received/processing/applied/rejected_duplicate/rejected_stale/dead_letter`) **before** processing; state transitions are idempotent. Unique key: (school_connection_id, provider_event_id), falling back to (school_connection_id, external_ref, event_type, payload_hash) where no stable ID exists.
- **Durable outbox:** every outbound booking command is written in the **same database transaction** as the booking-state change it accompanies (atomic boundary). A worker claims pending outbox rows with a **lease** (`lease_expires_at`); expired leases are re-claimable; delivery marks terminal outcomes (`delivered`, `failed_terminal` after retry exhaustion).
- **Acknowledgment rule:** receipt is acknowledged to the sender **only after durable storage**. A `429`-rejected request has *not* entered the inbox — the sender retains retry responsibility.
- **Ordering (canonical):** prefer the provider's **revision/sequence field**; otherwise compare `occurred_at` against the **latest accepted authoritative state transition, regardless of state**. Events older than the watermark are `rejected_stale`, never applied. Equal/missing/unreliable ordering → retrieve authoritative state and reconcile — never guess.
- **Retries and dead letters:** bounded retries with exponential backoff (configurable per connection: default max 5, initial 30s, max interval 1h); exhausted budgets dead-letter with **redacted payload retention** (bounded duration, personal data minimized) and an ops task — never silent drops.
- **Reservation always authoritative:** availability search may use a scalable read model, but the final reservation requires a transactional reserve/commit against the authoritative route, including the complete resource bundle — no partial holds, no process-local locks.
- **Unresolved commands persist as a distinct disposition:** each outbox command carries a business-outcome disposition separate from its delivery state — `outcome: 'pending' | 'confirmed' | 'not_confirmed' | 'unresolved'`. A request timeout, hold-TTL lapse, or retry exhaustion **never proves a remote commit failed**; such commands persist as `unresolved`, the affected inventory is **quarantined** (never re-sold), and quarantine is released only by an authoritative result or an **audited operational decision** (ops task with recorded rationale) — never by the passage of time alone. "Delivered" means the command reached the adapter; it does not mean "confirmed," and retry exhaustion does not mean "not booked."
- **Three response meanings, never conflated:** (a) *receipt acknowledged* (202 + recorded duplicate) — not acceptance; (b) *accepted for processing* — not confirmation; (c) *authoritatively confirmed* — only after atomic reserve/commit or exclusive allocation. A `202` never becomes confirmation by implication.

## 7. The Connectivity API (partner-facing contract)

One versioned REST API. **DriveLinkUp hosts the platform endpoints (§7.1); the vendor hosts the adapter endpoints (§7.2).** Two integration paths: vendor-maintained or DriveLinkUp-maintained (same §7.2 contract, run by DriveLinkUp against a vendor-permitted interface). Where neither exists: **unsupported**.

### 7.1 DriveLinkUp-hosted endpoints (partner → platform)

**Authentication and signing:** partner credentials are environment-scoped (sandbox/production) and revocable. Every request carries headers: `X-DLU-Partner-Id` (credential identifier), `X-DLU-Timestamp` (ISO-8601; requests outside a ±5-minute window are rejected 401), `X-DLU-Signature` (HMAC-SHA256 over `method + path + timestamp + body` with the partner secret), and `X-DLU-Connection-Id` (binds the call to one connection and its school — cross-connection use of a credential is 403). Tenant isolation derives from authenticated grants, never request-supplied school IDs.

| Endpoint | Method | Purpose |
|---|---|---|
| `/v1/connections` | GET | List the partner's connections (id, school, environment, scopes, status) |
| `/v1/connections/{id}/availability` | PUT | Upsert bookable windows/prices/restrictions (idempotent by window key) |
| `/v1/connections/{id}/content` | PUT | School profile facts/offerings/policies (published only after school approval) |
| `/v1/connections/{id}/events` | POST | Push changes/cancellations/expiries (same dedup/ordering as §6.4) |

**Availability upsert example:**

```json
PUT /v1/connections/conn_8f3/availability
{
  "windows": [
    { "offering_ref": "off_b1_60min",
      "starts_at": "2026-11-03T08:00:00+01:00",
      "ends_at": "2026-11-03T09:00:00+01:00",
      "resource_bundle": { "instructor_ref": "ins_anna", "vehicle_ref": "veh_124", "location_ref": "loc_main" },
      "price": { "amount_minor": 76000, "currency": "SEK" },
      "idempotency_key": "win_20261103_anna_0800" } ]
}
→ 200 { "accepted": 1, "duplicates": 0 }
```

**Identifier rules (canonical):** a **correlation ID** traces one logical operation across logs, events, and ops tasks (propagated on every call and stored on every row it touches). An **idempotency key** makes a single operation exactly-once, **namespaced per (connection, operation type)** — keys under different operation types are structurally independent namespaces, so cross-operation reuse cannot collide; within the same namespace, replays return the original result, and reusing a key with a **different payload** returns `422 idempotency_key_conflict` (never silent reuse).

Errors: `{ "error": { "code": "forbidden_scope", "message": "…", "retryable": false } }` — 401 credential/signature/timestamp, 403 grant/scope/connection mismatch, 404 unknown connection, 422 validation/key conflict, 429 rate-limited (retryable, retry-after). Rate limits: per-partner and per-connection budgets; backpressure never silently drops durably-received events.

### 7.2 Vendor-hosted adapter endpoints (platform → vendor)

Auth: same HMAC scheme, per-connection adapter credentials. **Synchronous** hold/commit/reschedule/cancel; **asynchronous** events with the §6.4 inbox.

| Endpoint | Method | Purpose |
|---|---|---|
| `/adapter/reservations/{ref}/hold` | POST | Atomically reserve the complete resource bundle for a TTL; `held` (with `hold_expires_at`) or `409 conflict` — never partial |
| `/adapter/reservations/{ref}/commit` | POST | Commit the hold into a confirmed vendor-side reservation (idempotent) |
| `/adapter/reservations/{ref}/release` | POST | Release a hold (expiry/cancel) |
| `/adapter/reservations/{ref}/cancel` | POST | Cancel a confirmed reservation per policy |
| `/adapter/reservations/{ref}/reschedule` | POST | **Atomic swap:** release old bundle + hold/commit new bundle in one vendor-side operation; returns both outcomes — required for connector-route rescheduling (§6.3) |
| `/adapter/state/{ref}` | GET | `getAuthoritativeState` for one reservation or window |
| `/adapter/state` | POST | Full authoritative-state resync for the connection; drift reported to reconciliation |

**Hold example:**

```json
POST /adapter/reservations/res_a91/hold
{ "offering_ref": "off_b1_60min",
  "starts_at": "2026-11-03T08:00:00+01:00", "ends_at": "2026-11-03T09:00:00+01:00",
  "resource_bundle": { "instructor_ref": "ins_anna", "vehicle_ref": "veh_124", "location_ref": "loc_main" },
  "hold_ttl_seconds": 900, "idempotency_key": "res_a91_v1" }
→ 200 { "status": "held", "hold_ref": "hold_x42", "hold_expires_at": "2026-11-01T10:15:00Z", "vendor_reservation_ref": "T-55231" }
→ 409 { "error": { "code": "resource_conflict", "retryable": false } }
```

**Required request/response schemas (each operation):**

- **commit** — request: `{ "hold_ref": "hold_x42", "idempotency_key": "..." }` (identifies the hold being committed). Response: `{ "status": "confirmed", "vendor_reservation_ref": "T-55231", "confirmed_at": "..." }`; `404 absent` if the hold expired or never existed (a valid terminal outcome — the caller re-evaluates from authoritative state, never assumes failure).
- **release** — request: `{ "hold_ref": "hold_x42", "reason": "expiry" | "cancel", "idempotency_key": "..." }`. Response: `{ "status": "released" }` or `404 absent` (already gone — not an error to retry).
- **cancel** — request: `{ "vendor_reservation_ref": "T-55231", "reason": "...", "idempotency_key": "..." }`. Response: `{ "status": "cancelled", "refund_route": "per_policy" }` or `409 { "code": "already_terminal", "current_status": "completed" }`.
- **reschedule (atomic swap)** — request: `{ "vendor_reservation_ref": "T-55231", "new_offering_ref": "...", "new_starts_at": "...", "new_ends_at": "...", "new_resource_bundle": { ... }, "hold_ttl_seconds": 900, "idempotency_key": "..." }`. Response: `{ "status": "rescheduled", "old": { "status": "released" }, "new": { "status": "confirmed", "vendor_reservation_ref": "T-55232", "confirmed_at": "..." } }` — **the replacement is always `confirmed`**, never merely `held` (a held replacement that later expires would destroy the customer's confirmed booking). Or `409 { "code": "resource_conflict", "old": { "status": "confirmed" } }` (the original stays intact; nothing was released). No intermediate state is ever observable: the vendor either swapped both sides or neither.
- **getAuthoritativeState (single)** — response: `{ "status": "held" | "confirmed" | "cancelled" | "expired" | "absent", "vendor_reservation_ref": "...", "occurred_at": "...", "revision": 17 }` — `absent` means the vendor has no record (valid terminal); a response never returns "unknown" without an `occurred_at`/`revision` pair explaining the ambiguity.
- **resync (connection)** — request: `{ "cursor": "...", "limit": 500 }`. Response: **paginated vendor-state snapshots**: `{ "snapshots": [ { "vendor_reservation_ref": "...", "status": "...", "occurred_at": "...", "revision": 17 } ], "next_cursor": "..." }`. The vendor reports only its own state; **DriveLinkUp computes drift** by comparing snapshots against its own latest accepted state — the vendor never receives or echoes DriveLinkUp state. Drift is reported to reconciliation, never auto-applied over the latest accepted authoritative state.
- **inbound events (partner → DriveLinkUp)** — request: `{ "event_id": "evt_55", "vendor_reservation_ref": "T-55231", "type": "confirmed" | "cancelled" | "rescheduled" | "expired" | "changed", "revision": 18, "occurred_at": "...", "payload": { ... } }` — processed per §6.4 (dedupe on event_id within the connection; ordering by revision, else occurred_at vs watermark; equal/missing → authoritative-state retrieval).

**Unresolved is not terminal:** when hold/commit times out and the authoritative state cannot be read, the command persists `unresolved` with quarantine per §6.4; no assumed confirmation; potentially-committed inventory is never re-sold while unresolved. Availability push + reservation retrieval do **not** implement authoritative booking acceptance — §7.2 does.

## 8. Partner lifecycle and certification

**Readiness milestones (canonical):** (1) vendor access and commercial use approved — signed agreement; (2) documentation, credentials, test environment — vendor-issued sandbox credentials; (3) connector implemented — code + integration tests against vendor sandbox; (4) failure tests pass — against the vendor's **real test environment**, not mocks; (5) pilot confirms bookings become authoritative in the external system.

**Milestone-4 failure tests (reproduced, against the vendor's real test environment):**

1. Concurrent external/internal booking of the same resource cannot both confirm.
2. Duplicate and out-of-order events cannot duplicate bookings or charges, and cannot overwrite the latest accepted authoritative state of any kind — including the newer-cancellation-then-older-confirmation case.
3. Rescheduling releases old resources and reserves new ones atomically.
4. Payment after reservation expiry has a deterministic outcome (booking stays expired; payment flagged `late_captured`; ops route).
5. Revoked vendor access or detected stale inventory disables instant booking until authority is restored or another verified control applies.

**Capability approval table (each capability is separately certified and separately production-enabled):**

| Capability | Agreement/access evidence | Tests | Pilot | Production enablement |
|---|---|---|---|---|
| Availability display | signed agreement + sandbox credentials | sandbox upsert tests (milestone 3) | not required | availability feed for `availability_display`-authorized schools |
| Content sync | signed agreement + sandbox credentials | sandbox content tests | not required | content feed, school-approved |
| Changes & cancellations (events) | as above + event contract review | **its applicable tests:** authentication, tenant/environment isolation, durable receipt, deduplication, ordering, recovery | not required | event ingestion for authorized connections |
| **Transactional booking** | as above + transactional terms | **failure tests 1, 2, 4, 5** (concurrent conflict; duplicate/out-of-order events; late payment; revoked access/staleness) | **milestone 5 pilot: bookings become authoritative externally** | hold/commit operations for `transactional_booking`-authorized schools |
| **Transactional rescheduling (atomic swap)** | as above | **failure test 3** (atomic release + reserve), via the §7.2 swap operation | required with the transactional pilot | the `/reschedule` operation only |
| Payments | payment-provider decision [EXTERNAL] | payment-event tests | required | `payment_collection` only |

**Three separate statuses, never conflated:** partner status (candidate/certified/suspended — operational quality), capability certification (per product/version/market, milestone-gated per the table), and capability production enablement (per capability, `prod_enabled`). The transactional capability alone requires milestone 5. A limited-capability partner appears in the directory with exactly its certified capabilities and no booking implication.

**Tier gates:** Candidate → Certified (operating in production under approved support coverage, named escalation ownership, and measurable service targets — approved before production certification; none are contractual today). Premier deferred until operational evidence exists.

**Lifecycle:** suspension stops new bookings but never abandons existing bookings' cancellation/refund/support; orderly disconnection includes export, notice period, school handover; credential revocation immediate on request or incident; major API versions require recertification within the deprecation window. **Directory and badges:** "Synced by Vendor X" is a statement of integration, not verification and not school consent; brand assets require a separate rights basis; listing respects school restrictions, accuracy, and brand rights.

## 9. Domains and primary flows

**Student (demand):** discover → compare → engage at the school's mode (§4) → book/pay → manage → review. Guardian flows for minors per market. No student fee.

**School (supply):** onboarding → verification → authorization scopes → listing/prices/policies → inventory (native diary for delegated inventory, allocation, or connection) → requests/acceptance or instant bookings → payouts/earnings → support.

**Partner (connectivity):** apply → agreement [EXTERNAL] → sandbox → milestones → capability-scoped production → operations.

**Platform administration:** verification review queue, authorization registry, partner registry/certification, reconciliation conflicts, complaints workflow (record → suspend disputed functions → verify on the live surface → fresh authorization to re-enable), audit log, market-release gates.

**Verification essentials (canonical):** displayed claims match stored evidence exactly (date + method); permit verification per market via the official-source matrix (Bolagsverket/Transportstyrelsen, Brreg/Vegvesen, CVR/virk.dk, PRH/YTJ, Traficom, Skatturinn — each with its own access status [EXTERNAL]); e-ID brokers per market with age rules; exception-based document verification where registers don't expose data; instructor claims use the correct criterion (approved trafiklärare with school affiliation — not licence duration); guardian consent per market; evidence retention minimal (no document images by default; temporary authorized collection only). **All release scenarios are reproduced in Appendix A.**

## 10. Market scalability

A market = a country launch. Each market adds a **plugin, not a fork**: official-source verification matrix, e-ID broker rules, languages, currency, timezones, school-approved business-day calendars and cancellation rules. Launch gates [EXTERNAL per market]: register API access or documented manual verification route; e-ID broker terms; payment-provider coverage; language completeness (i18n parity test canonical); legal review of permit-disclosure routes. No market launches on invented access.

## 11. Data model — existing vs new (verified against current main)

**Existing entities [OBSERVED-MVP]:** User/Session/Account, Instructor (with `bookingMode`, `providerRole`, `userId`), InstructorLicense, Booking (with slotId, student fields, payment/escrow columns), PayoutRecord, AvailabilitySlot, Offering, OfferingRequest, Organization, Membership/MembershipInvite, Review, GoogleReview, Conversation/Message, ContactMessage, Dispute, LateCancellationFee, StripeWebhookEvent, VerificationEvent, DiditWebhookEvent, PhotoVerification, BookingReceipt, SavedPaymentMethod, Waitlist*, RebookingCache, HandledareEnrollment, ClickwrapAcceptance, ConsentEvent, CleanupRun.

**School mapping (canonical, verified against current main):** a "school" today is an `Instructor` row with `providerRole='SCHOOL'` (the listing). **`Instructor` has no `organizationId` column** — the listing links to a user via the nullable scalar `Instructor.userId`, and the organization is reached through that user's `Membership` rows (`User → Membership → Organization`; the live bookings route resolves affiliation this way). `SchoolAuthorization` and `SchoolConnection` attach to the **listing row** (Instructor id). **Observed vs proposed, kept separate:** the repository derives affiliation on the fly from the owner's membership (ambiguous with multiple memberships, and mutable when ownership changes) — the proposed design instead **persists an explicitly verified listing-to-organization binding** (`ListingOrgBinding`, verified by the school, auditable, review-gated on change). Bookings **snapshot** their school/organization context at creation; authorization for booking mutations reads the snapshot and the verified binding — never "the owner's first/current organization." Unknown bindings require review, not selection. Guest bookings keep their token-hash access path; a submitted-email match alone never authorizes management. **Verification:** an owner belonging to two organizations cannot expose one school's bookings to the other; a directory-only school's bookings are never manageable by a user whose only tie is an unverified binding. Offerings and availability already key on the Instructor. Do not introduce a parallel School table in Phase 1 — extend the listing row.

**Existing field → proposed change → migration behavior:**

| Existing (verified) | Proposed change | Migration behavior |
|---|---|---|
| `Instructor.bookingMode` ('instant'/'request'/'contact') | `SchoolAuthorization` scopes | Historical config, never evidence: grants only from documented school authorization; `contact` → explicit restriction imports cannot lift (§1) |
| `Instructor.cancellationPolicyTier` (snapshotted on Booking) | `CancellationPolicy` versioned + per-booking snapshot | Legacy tiers import as **draft/unverified — never auto-active** (the platform default "24 hours" was explicitly rejected by a school; promoting it to an approved policy would fabricate school approval). Activation requires school approval; existing Booking snapshots remain valid as historical records, not as evidence of approval |
| `Booking.paymentStatus` / `stripeSessionId` / `paidAt` / escrow columns (`heldAt`, `deliveredAt`, `confirmedAt`, `autoReleaseAt`, `disputeStatus`, …) | `payment_state` derived from `PaymentRecord` | Additive: keep legacy columns readable; `PaymentRecord` backfill from authoritative Stripe records only; no client-sourced state |
| `Booking.studentUserId` (nullable scalar FK) + `learnerAccessTokenHash` | ownership rule `student_id = caller` | **Guest-booking exception (mandatory):** bookings with no linked student user remain manageable via the existing bearer-token hash or matched-email identity evidence — the new ownership rule must not strand existing guest bookings |
| `AvailabilitySlot.bookedBookingId` / `bookedAt` | `Hold` + `BookingResourceAssignment` | Additive: booked slots stay authoritative for existing bookings; new holds apply to new instant bookings only |
| `Offering` (price, kind; no duration/buffers) | `duration_minutes` + buffer fields | Additive columns; offerings without duration keep working on the request path |
| (none) | accepted-event watermark per connection | New field on `SchoolConnection`; initialized from the first accepted authoritative transition after go-live — never fabricated from history |

**New entities [PROPOSED]:**

| Entity | Fields (essential) / constraints |
|---|---|
| `Partner` | id, legal_name, org_number, country, status(candidate/certified/suspended), created_at. Unique on (country, org_number). |
| `PartnerApplication` | id, partner_id FK, state machine (applied→agreement→sandbox→testing→pilot→decision), decided_at. |
| `Certification` | id, partner_id FK, product, version, market, capabilities[], milestone_evidence jsonb, maintenance_owner, **`prod_enabled` jsonb (per capability)**. Unique on (partner_id, product, version, market). |
| `SchoolConnection` | id, listing_id FK (Instructor), partner_id FK, environment(sandbox/production), credentials_ref, status. Unique on (listing_id, environment). Sandbox data never reaches production surfaces. |
| `SchoolAuthorization` | id, listing_id FK, granted_scopes text[], authorized_by_user_id (server-resolved), evidence_ref, effective_from, withdrawn_at, history jsonb[]. Withdrawal never deleted; unique on (listing_id, effective_from). |
| `CancellationPolicy` | id, listing_id FK, version int, deadline_type, deadline_value jsonb, timezone, business_calendar jsonb, wording, source, approved_at, state. One active version per listing. Snapshot per booking. |
| `Resource` | id, listing_id FK, kind('instructor_slot'/'vehicle'/'location'), ref_id. |
| `Hold` | id, booking_id FK, resource_id FK, window_start, window_end (buffers included), state('active'/'committed'/'released'), expires_at. |
| `Allocation` | id, listing_id FK, offering_id FK, resource_id FK, window_start, window_end, state('offered'/'accepted'/'consumed'), accepted_at, controller_user_id, diary_acknowledgment. Unaccepted allocations back nothing; DB exclusion prevents two active bookings on one window. |
| `BookingResourceAssignment` | booking_id FK, resource_id FK, allocation_id FK nullable, created_at. A booking may hold several (instructor + vehicle + location). |
| `BookingEvent` (inbox) | id, school_connection_id FK, provider_event_id, external_ref, event_type, payload_hash, occurred_at, received_at, processing_status, lease fields. Unique on (school_connection_id, provider_event_id) with the composite fallback. |
| `CommandOutbox` | id, command_type, school_connection_id FK, correlation_id, idempotency_key, payload, state('pending'/'claimed'/'delivered'/'failed_terminal'), **`outcome`('pending'/'confirmed'/'not_confirmed'/'unresolved')**, `quarantine`: affected resource refs + interval (persisted, overrides ordinary TTL-expiry hold release), `resolution_ref` (authoritative reconciliation result or audited ops decision), lease_expires_at, attempt_count, next_retry_at, dead_letter_at. Retry bounds per §6.4. **TTL expiry and retry exhaustion never release quarantine** on a potentially committed remote reservation. |
| `ListingOrgBinding` | id, listing_id FK, organization_id FK, verified_at, verified_by_user_id, state. Unique active binding per listing. Change requires review. |
| `BookingStateTransition` / `PaymentRecord` / `OpsTask` / `AuditLog` | transition rows (from, to, actor, correlation_id); payment state only from authoritative records (`late_captured` flag); ops queue with redacted-payload retention; every authorization/certification/admin action audited. |

Constraints: tenant isolation from authenticated grants; no request-trusted school IDs; environment separation; audit on every authorization, certification, and admin action.

## 12. Success metrics

Leading: schools by mode; active connections; partner applications in flight; milestone throughput; request acceptance rate/latency; inbox depth and dead-letter rate; reconciliation drift incidents. Lagging: confirmed bookings per market; commission-attributed revenue (documented origin only); school retention; student repeat bookings; incidents by severity. Baselines must be measured before targets are set — no invented numbers.

## 13. Build sequence for Cursor

**Phase 0 is mandatory first.**

- **Phase 0 — Repository inventory and gap map:** Cursor reads the repo (AGENTS.md conventions, prisma/schema/*, existing routes/components/tests) and produces a gap map against this spec — existing vs missing entities, routes, services — plus the evidence-gated migration plan for `bookingMode` → `SchoolAuthorization` (§1). No new architecture in this phase.
- **Phase 1 — Authorization and safety:** `SchoolAuthorization` + scopes, withdrawal semantics, server-side enforcement on all booking/request/availability entry points, complaints workflow, non-destructive migration + migration tests. *Acceptance: SC-1…SC-4, SC-13, SC-14.*
- **Phase 2 — Canonical booking services:** policy service (§6.1), state machine (§6.2) with transition rows, payment/commission/concurrency rules (§6.3), cancellation-policy versioning + snapshots. *Acceptance: SC-5, SC-6, SC-10, SC-15, SC-16.*
- **Phase 3 — Reliable processing:** inbox/outbox per §6.4, idempotent processing, bounded retries, dead-letter, reconciliation. *Acceptance: SC-11, SC-12.*
- **Phase 4 — Connectivity API:** partner auth (§7.1), adapter contract (§7.2), webhook signing, sandbox/production isolation, rate limits. *Acceptance: SC-7, SC-9.*
- **Phase 5 — Certification and admin tooling:** partner registry, milestone evidence tracking, capability-scoped `prod_enabled`, admin console surfaces, school-facing connection UX, partner directory. *Acceptance: SC-8.*
- **Phase 6 — Pilot and production:** approved vendor pilot [EXTERNAL], milestone 4/5 runs, production certification, broader rollout. No vendor invitations are part of the build.

## 14. Rollout posture

First-party adapters and outreach continue (16 vendors contacted 22 Oct 2026; one reply recorded). Invited pilots selected by documented access, vendor willingness, a willing school, and controllable inventory — not brand preference. Open applications only after the first production certification. The program is not announced publicly before then. Commission rate, liability terms, and service targets are internal/legal-review items and must not appear in partner-facing build artifacts.

## 15. Acceptance scenarios (canonical, Given/When/Then)

- **SC-1 (scope-specific withdrawal):** Given `request_to_book` withdrawn and `availability_display` granted, when the profile is viewed and a request submitted, then times render, the request is rejected server-side, and a zero-scope school renders directory-only.
- **SC-2 (withdrawal survives refresh):** Given withdrawn scopes, when school data is re-imported, then withdrawal and history persist and no booking surface reappears.
- **SC-3 (no auto-enable):** Given a certified partner connection and a verified school with zero granted scopes, when the listing is viewed and booking attempted via API, then directory-only and 403.
- **SC-4 (existing bookings survive):** Given a withdrawal, when an existing confirmed booking is cancelled or refunded, then those paths succeed.
- **SC-5 (202 ≠ confirmation):** Given a reservation intent acknowledged 202, when the commit times out, then the booking is not confirmed; `getAuthoritativeState` resolves it; an unresolvable state stays unresolved with an ops task — never assumed confirmed, never re-sold.
- **SC-6 (authoritative conflict check):** Given two concurrent instant bookings for the last bundle, when both submit, then exactly one confirms; the other receives 409 and no partial hold exists.
- **SC-7 (milestone gating):** Given a connector whose tests passed only against mocks, when production enablement is attempted, then it is refused.
- **SC-8 (capability-scoped production):** Given an availability-only certified integration in production, when instant booking is attempted for its schools, then it is refused — the transactional capability was not certified — while a separately authorized native or allocation route may still provide valid booking authority for that school.
- **SC-9 (tenant isolation):** Given a partner authenticated with connection A, when operations target connection B's school, then 403 — grants, not request IDs, define scope.
- **SC-10 (cancellation policy):** Given "cancel by 13:00 the previous business day" on an approved Mon–Fri calendar, when a student books a Monday 10:00 lesson, then the deadline is Friday 13:00 school-local, snapshotted on the booking; unknown policy → no policy displayed and no booking-dependent checkout.
- **SC-11 (event dedup/ordering):** Given a duplicate vendor event, when received, then 202 + `rejected_duplicate` with no re-application; given an event older than the watermark (by provider revision or occurrence time), then `rejected_stale`, never applied; given equal/missing ordering, then authoritative-state retrieval, never a guess.
- **SC-12 (dead-letter):** Given a poison event exhausting its retry budget, when the budget is exceeded, then it dead-letters with a redacted payload and an ops task — never silently dropped.
- **SC-13 (inquiry-only, no times):** Given a school granting only `inquiry_collection`, when availability is requested and the inquiry form rendered, then no times or bookable inventory are returned and the form renders without availability claims.
- **SC-14 (migration, legacy request without evidence):** Given a legacy `bookingMode='request'` school with no documented authorization, when the migration runs and the profile is viewed, then the school is directory-only, its listings and financial history are intact, and its existing bookings remain cancellable/refundable.
- **SC-15 (late payment):** Given a payment captured for an expired booking, when the payment is reconciled, then the booking stays `expired`, the payment is flagged `late_captured`, and an ops task offers only void/refund or a new booking — never auto-confirmation.
- **SC-16 (manual acceptance without connector):** Given a request-to-book school with no connector, when the school accepts manually, then acceptance succeeds with E0–E3 re-evaluated, the commitment route is recorded, and no milestone-5 connector is required.
- **SC-18 (no fabricated policy approval):** Given a school whose only policy data is the legacy platform-default tier, when the migration runs, then the imported `CancellationPolicy` is draft/unverified and no active policy is displayed — the school's historical booking snapshots remain valid as records, not as approval.
- **SC-19 (org-binding isolation):** Given an owner with memberships in two organizations, when booking-management authorization is evaluated for either school, then only the school whose verified listing-to-organization binding matches is exposed; a user whose only tie is an unverified binding gets review, not access.
- **SC-20 (quarantine survives expiry):** Given a commit that timed out, when the hold TTL lapses and retries are exhausted, then the affected inventory remains unavailable (quarantine persists) until an authoritative reconciliation result or an audited operational decision releases it.
- **SC-17 (directory visibility without onboarding):** Given a school that permits directory display but has not completed booking onboarding and has no active offerings, when its profile is viewed, then info, prices, and reviews render with **no booking surfaces**, and verification badges reflect only stored evidence.

## Appendix A — Verification release scenarios (canonical)

| ID | Given/When/Then |
|---|---|
| VF-a | Given a school rep without a signatory match, when onboarding, then completion is blocked without delegation review. |
| VF-a2 | Given JA FULLMAKT, when onboarding, then the route is manual mandate inspection, not auto-approval. |
| VF-a3 | Given JA TILLSAMMANS with only one participant authenticated, when onboarding, then completion is blocked. |
| VF-a4 | Given JA LÖPANDE, when onboarding, then a documented scope review of the marketplace agreement is required before activation. |
| VF-b | Given a student with verified contact but no e-ID, when booking where market rules allow, then the booking proceeds. |
| VF-c | Given an expired permit, when gating runs, then the affected offering is disabled pending resolution while identity verification is preserved. |
| VF-c2 | Given a never-verified school, when activation is attempted, then the bookable offering cannot activate. |
| VF-d | Given STR "not found", when badge logic runs, then no membership badge and no review block. |
| VF-e | Given a failed Twilio verification, when booking confirmation is attempted, then confirmation is blocked but browsing is unaffected. |
| VF-f | Given a completed document check, when stored, then the result + reference are stored, not the document image. |
| VF-g | Given a guardian-consent flow for a 16-year-old, when completed, then it completes without an e-ID requirement on the student and the relationship/authority evidence is recorded. |
| VF-h | Given an entity outside the PRH/YTJ API's documented coverage, when verification runs, then it routes to manual review, not rejection. |
| VF-i | Given a Finnish instructor verification, when evidence is produced, then it must explicitly establish the named person's current instructor permission before the badge activates — an extract that does not explicitly establish the permit does not qualify. |
| VF-j | Given a Danish instructor onboarding, when evidence is collected, then the kørekort with påtegning or written § 24 approval is collected as documentary evidence, and the verified badge requires a positive aktindsigt/status confirmation — a submitted-but-unanswered request does not activate it. |
| VF-j2 | Given a Finnish autokoululupa verification, when the school's offering activates, then a positive permit confirmation exists — a pending inquiry does not qualify. |

## Appendix B — Student/school API contracts (canonical)

All mutating endpoints take an `Idempotency-Key` header; responses scoped server-side by actor membership; errors structured `{error: {code, component?, detail}}`.

- **POST /api/schools** — create draft. Checks: company_exists (register API or manual path per market); duplicates by (country, organization_number) → 409. Output `201 {school_id, listing_status, next_steps[]}`.
- **POST /api/schools/{id}/representative-verification** — start e-ID; broker unavailable → `503 {code: 'eid_unavailable', fallback: 'manual_review'}`.
- **POST /api/schools/{id}/signatory-check** — Bolagsverket mode logic: `JA_ENSAM` → pass; `JA_TILLSAMMANS` → `202 {requires: 'co_signature'}`; `JA_LOPANDE` → `202 {requires: 'scope_review'}`; `JA_FULLMAKT` → `202 {requires: 'mandate_inspection'}`. **Temporary-source-outage rule:** when a register is unavailable, previously valid, unexpired evidence **remains effective** with a re-check flag (review queue); a never-verified school, or one whose evidence is confirmed expired/revoked, **cannot use the exception** — activation of bookable offerings stays blocked.
- **POST /api/schools/{id}/teaching-permit-evidence** — submit; `202 {verification_record_id, status: 'pending'}`.
- **POST /api/schools/{id}/instructors** — attach; checks instructor permit + affiliation (Appendix A, VF-i/j).
- **POST /api/schools/{id}/connection** — select vendor-neutral route; transaction_capable only via connector milestone.
- **POST /api/schools/{id}/activate** — onboarding-gate checks first (representative identity, company-register match, signatory authority), then E1/E2 (E4 per offering for instant display; request-to-book offerings activate without a control route). `'active'` only when gates pass; else `403 {component}`.
- **POST /api/admin/review-queue/{item_id}/resolve** — admin; transitions verification_record; re-evaluates affected offerings.
- **POST /api/schools/{id}/offerings** / **PATCH /api/offerings/{id}** — category/price changes re-run scope checks; category changes can disable the offering.
- **GET /api/schools/{id}/availability** — consumes the authorization + saleability-gated mode decision (§4): times only with `availability_display`; inquiry-only without times; zero scopes → `mode: 'directory_only'`; derived server-side.
- **POST /api/schools/{id}/authorizations** — grant/withdraw scopes; staff may suspend/withdraw; grants/restoration require fresh evidence from a server-side-identified school representative.
- **POST /api/schools/{id}/allocations** — create protected slice; conflicts → 409.
- **POST /api/bookings** — create (instant or request). Request body: `{ offering_id, start_time, resource_preferences?, guardian_consent_ref?, mode?, idempotency_key }`. Instant: server-side bundle assignment, atomic complete-bundle hold, `409 {code:'resource_unavailable', missing[]}` with no partial hold; request: no holds. Attaches `cancellation_policy_snapshot` and computes the deadline; **unknown policy → no booking-dependent checkout**. Authorization scopes checked (SC-3); `403 not_authorized_by_school` otherwise. Output `201 {booking_id, booking_state: 'pending', ttl?, assigned_resources?}`. Guest bookings (no linked student user) are created via the existing learner-token path and remain manageable under it (§11 migration table).
- **POST /api/bookings/{id}/accept** — request acceptance, school/instructor actor. Request body: `{ commitment_route: 'native' | 'allocation' | 'external_manual', allocation_id?, external_ref?, note?, idempotency_key }`. E0–E3 re-evaluated at acceptance; **E4 not required**; the commitment route is recorded, or the request stays `pending`. A native/allocation commitment makes the booking's own holds/allocations satisfy E4 at confirmation; `external_manual` records the school's commitment without simulating vendor authority.
- **POST /api/bookings/{id}/reschedule** — ownership rules; atomic release+reserve; connector routes only via the §7.2 atomic swap (separately certified capability).
- **POST /api/bookings/{id}/cancel** — ownership rules; policy eligibility after ownership; state transition + refund route per policy.
- **POST /api/schools/{id}/allocations** — create a protected inventory slice (offered state); conflicts → 409.
- **POST /api/allocations/{id}/accept** — controller (school-scoped role) accepts with diary acknowledgment; the allocation becomes the booking-authority basis (E4) for bookings it covers.
- **POST /api/allocations/{id}/withdraw** — releases future bookability; existing confirmed bookings on the allocation keep their lifecycle (cancel/refund/support per §5).
- **POST /api/webhooks/connectors/{connector_key}** — record → dedupe → order → apply or `rejected_stale`/`rejected_duplicate`; `202` **conditional on authenticated, structurally valid, durably recorded input**; failed persistence → `5xx` (caller retries).
- **Payments boundary:** no payment endpoints in this spec — provider TBD; `payment_records` ingested from authoritative provider records only; late-captured payments per §6.3.

**Contract-level acceptance:** API-1 (school scope + role enforced server-side; foreign-school token → 403), API-2 (webhook 202 duplicate + `rejected_duplicate`), API-3 (per-component activation errors), API-4 (ownership: foreign student/school → `403 not_booking_owner`, no changes), API-5 (instant: missing resource → structured 409, no partial hold; request path: no holds), API-6 (saleability bypass → E0 error, no booking), API-7 (zero/withdrawn scopes → 403 on all entry points), API-8 (inquiry-only → no times), API-9 (availability survives request withdrawal).

## 16. Traceability (external documents → sections here)

| Source | Consolidated into |
|---|---|
| Pack specs/00 (overview, NN1–NN10) | §2, §4, §5, §10 |
| Pack specs/01 (architecture, Gate 0) | §13 Phase 0 |
| Pack specs/02 (data model, migration) | §1, §5, §11 |
| Pack specs/03 (booking engine, E0–E4, BK-1…21) | §4, §6 (BK series remains the pack's detailed test record; SC-1…17 here cover the consolidated rules) |
| Pack specs/04 (verification, VF-a…j2) | §9 + **Appendix A** |
| Pack specs/05 (connectors, CN-1…5) | §6.4, §7, §8 |
| Pack specs/06 (UX journeys, UX-1…5) | §9 |
| Pack specs/07 (delivery plan) | §13 |
| Pack specs/08 (API contracts, API-1…9) | §7 + **Appendix B** |
| Connectivity Program Design v0.1 | §7, §8, §14 |

## 17. Open questions (owner: founder unless noted)

1. Pilot incentive: stipend vs. demand access alone (§14).
2. Partner directory: show tiers or capability badges only (§8).
3. Public program announcement timing (§14).
4. Payment-provider decision [EXTERNAL] — blocks `payment_collection` capability certification.
5. Legal review of liability caps, SLA values, DPAs [EXTERNAL — counsel].
6. Per-market register/e-ID access [EXTERNAL per market].
7. Refund-commission policy (pro-rata vs clawback) — explicit commercial gate before Phase 2 implementation.

---

*Provenance: TABS AS (Norway) reply of 23 Oct 2026 (support@tabs.no) is [VENDOR-REPORTED], narrowly scoped to the requested integration. Swedish TABS sunset 31 Dec 2026 per the vendor notice ([tabs.teoricentralen.se](https://tabs.teoricentralen.se/)). Reference model for §7–§8: [Booking.com Connectivity documentation](https://developers.booking.com/connectivity/docs).*
