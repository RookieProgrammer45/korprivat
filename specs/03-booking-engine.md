# 03 — Booking Engine

**Req ID prefix:** BK. Fixes B1 and B6 via capability flags; implements plan §7. The **policy service** in §1 is canonical — every booking action calls it with its action-specific checks. The UI never re-implements it.

## 1. Policy service — one decision point, action-specific checks

One server-side policy service evaluates the components E0–E4 below; which components apply depends on the **action**, not a blanket rule. (Activation cannot evaluate student eligibility — no student exists yet; manual acceptance must not secretly require a milestone-5 connector — the request-to-book product is preserved.)

| Component | Definition | Source |
|---|---|---|
| E0 (saleability) | The school has completed its onboarding gates (representative identity, company match, signatory outcome) and is `listing_status='active'`; the specific offering is `active` and not suspended | schools + offerings |
| E1 | School teaching permission **current for the offering's legal entity, location, and category** (scope match, not name match) | verification_records (school_teaching_permit, status=pass, valid) |
| E2 | Instructor permission and school affiliation where rules require both (Sweden: yes) | verification_records (instructor_teaching_permit, school_affiliation) |
| E3 | Student contact verified; lesson eligibility per market rules; guardian consent where the booker is a minor | students, verification_records (contact_verification, guardian_consent) |
| E4 | A **valid control route** for the actual resources being booked: transaction-capable connector (milestone 5), verified allocation (accepted allocation row in 'offered' state), or native workspace | school_capabilities + allocations + school_connections |

**Action → required checks (canonical matrix):**

| Action | E0 | E1 | E2 | E3 | E4 | Notes |
|---|---|---|---|---|---|---|
| Offering publication / activation | — | ✓ | ✓ (attached instructors) | — | — | no student exists yet; E0 is the outcome of this action |
| Request submission (request-to-book) | ✓ | ✓ | ✓ | ✓ | — | no resources held |
| Instant booking creation | ✓ | ✓ | ✓ | ✓ | ✓ | hold created atomically (DM holds) |
| Manual request acceptance | ✓ | ✓ (re-evaluated) | ✓ (re-evaluated) | ✓ (re-evaluated) | — | **E4 not required**: the school records the authoritative resource commitment itself (native/allocation/its own diary) or leaves the request pending — accepting a request must never require a milestone-5 connector |
| Confirmation (from pending) | ✓ | ✓ | ✓ | ✓ | ✓ (instant path) | re-validation at transition time |
| Rescheduling | ✓ | ✓ | ✓ | ✓ | ✓ (instant path) | re-validation; atomic release+reserve |
| Rebooking from a cancellation-slot alert | same as instant booking creation | | | | | eligibility never assumed from the alert |

Failures block the action with a structured, per-component error (no global "verification failed"). **Two failure kinds are distinguished everywhere (policy, API, UI):**

- **Unknown legal eligibility or permission** (E1/E2/E3 unresolved or failed) → the affected booking action is blocked; the profile shows review/contact modes only.
- **No instant-booking control route** (E4 absent) → request-to-book remains available, provided its applicable checks pass.

**How a manually accepted request commits resources:** the accepting school user chooses the commitment route — allocate from native availability (booking_resource_assignments via the workspace), consume an accepted allocation, or record an external commitment (e.g. the school's own diary) as `external_manual` evidence with a reviewer-visible note. The booking is `confirmed` with that route recorded on `bookings.commitment_route`; if no route is chosen, the request stays `pending`.

## 2. Booking state machine — explicit transition table

States: `pending`, `confirmed`, `in_progress`, `completed`, `cancelled`, `expired`, `no_show`.

| From | To | Trigger | Authorized actor | Prerequisites | Effects |
|---|---|---|---|---|---|
| — | pending | booking creation (instant) | student (via API) | policy: instant-booking checks pass; hold created | idempotency key recorded; TTL starts |
| — | pending | request submitted | student | policy: request-submission checks pass | no resources held |
| pending | confirmed | request accepted | school/instructor (school-scoped role) | policy: acceptance checks re-evaluated **at acceptance**; commitment route recorded (§1) | resources committed; `commitment_route` persisted |
| pending | confirmed | **system confirmation (native/allocation instant)** — booking TTL not elapsed, no manual step | system | policy re-validation passes; the booking's own valid active holds (or its accepted allocation already held by this booking) satisfy E4 | holds → assignments, committed atomically in one transaction with the state change |
| pending | confirmed | authoritative external confirmation event | connector | policy: E1–E3 pass; connector at milestone ≥5 | booking_state_transitions row |
| pending | expired | TTL elapsed | system | — | holds released; **no booking-state recovery from payment alone** (§4) |
| pending | cancelled | cancellation before confirmation | student or school | — | holds released |
| confirmed | in_progress | lesson start | system/school | — | — |
| in_progress | completed | completion record | school | — | commission calculation eligible |
| confirmed/in_progress | cancelled | cancellation | per cancellation-tier policy | — | refund route per policy; resources released |
| confirmed | no_show | school records no-show | school/instructor | — | per policy |

There is **no** `cancelled → no_show` transition. `expired` is terminal for the booking; a late payment never resurrects it (§4).

## 3. Capability flags, authorization, and the booking mode

Six flags per school (DM `school_capabilities`): `transaction_capable`, `read_only`, `allocation`, `native`, `calendar_sync`, `manual`.

**Authorization comes before capability (canonical order):**
1. Determine which actions the school **authorizes** (DM `school_authorizations` granted_scopes; zero scopes = directory-only — info and prices, no times, no request form, no contact CTA masquerading as booking).
2. Apply the verification/saleability checks (E0–E3, and E4 where the action requires a control route).
3. Choose a technically supported mode **within those authorizations**.
4. If the authorization for a specific surface is absent or withdrawn → that surface is removed (directory-only overall when zero scopes) — never an unauthorized request/contact fallback. Withdrawal disables the affected entry points **server-side**; existing links, cached cards, and queued prompts must not bypass it; refreshing imported school data must preserve the withdrawal.

**Canonical action-to-scope mapping (consumed by public display and server actions):**

| Surface / action | Required scope |
|---|---|
| Displayed times / availability | `availability_display` |
| Lead / inquiry form | `inquiry_collection` |
| Request-to-book (submission **and** acceptance/confirmation) | `request_to_book` |
| Transactional instant booking | `transactional_booking` |
| Payment collection | `payment_collection` (separate) |

Scope-specific consequences: withdrawing `request_to_book` removes the request form but leaves other granted surfaces intact (e.g. `availability_display` may still show times). Authorization is **re-checked at acceptance and confirmation** — a queued request cannot bypass a withdrawal made after submission. **Withdrawal never blocks cancellation, refunds, or support for existing confirmed bookings** — those operate on the booking lifecycle, not on new-entry authorization. A working vendor connector, verified permit, or school account never enables booking automatically — booking actions require the matching granted scope.

**Saleability gate (applies before the mode table):** if E0 fails (school onboarding gates incomplete, listing not active, or the offering inactive/suspended) or the applicable offering-permission checks (E1/E2) fail, **no booking CTA or bookable inventory is exposed** — the profile shows the permitted review/contact state only. Otherwise evaluate the control-route table below; a missing E4 alone permits request-to-book (where authorized).

**Derived booking mode (server-side, at read time):**

| Condition | Mode shown |
|---|---|
| `transaction_capable` AND E1 pass | instant |
| (`allocation` with an accepted allocation for the offering OR `native` with workspace onboarding complete) AND E1 pass | instant |
| `read_only` or `calendar_sync` only | request-to-book |
| `manual` only | request-to-book |
| None | contact ("Kontakta oss om tider") |

Fallback ladder: instant → request-to-book → contact. UI renders availability only where the mode supports it (fixes B6). **Display vs authority:** a `calendar_sync` school displays request-to-book; only E4 control routes create instant authority. The allocation/native instant rows require E1 — verification state gates display too.

## 4. Payment state is separate from booking state (fixes the unsafe late-payment contract)

- `bookings.payment_state` (none/authorized/captured/refunded/voided/disputed) is maintained **only from authoritative payment records** (DM payment_records). The booking engine never derives payment state from UI or vendor marketing.
- **Late payment after expiry:** if a payment was captured for an expired booking, the system does **not** auto-confirm the booking. Deterministic route: booking stays `expired`; the payment record is flagged `late_captured` (payment exception, not a booking state); an ops task is created with the two allowed resolutions — **void/refund** or, only if the resources are still free and the instant-booking policy checks pass, a **new booking** (not a state change of the old one). No automatic confirmation from payment.
- Currency is explicit per booking and per payment record; commission/refund amounts are computed per-currency. Minor units; no currency inference from integer fields.

## 5. Commission rules (provider-independent)

- `completed` is the only state that triggers commission (10% per published policy — SEK marketplace bookings).
- `origin = school_direct` (widget, R9): 0 kr acquisition commission. **Attribution is assigned server-side from trusted provenance** (the widget's registered origin token per school), never from a client-controlled parameter.
- `ingestion_method` never affects commission — `origin` does. Importing never initiates a charge.
- Refunds reverse commission per the authoritative refund record; the exact refund-commission policy (pro-rata vs full clawback) is an **explicit commercial gate** — record the decision in `specs/ARCHITECTURE-NOTES.md` before implementing (Gate 0 records it as documented-or-blocked; Cursor cannot decide policy).

## 6. Concurrency and idempotency

- All create/reschedule/cancel endpoints take an idempotency key; duplicate submissions return the original result.
- **Resource conflicts are enforced per resource + occupied interval (including buffers and active holds), across modes** (DM: canonical resource-conflict rule) — not per allocation. Two different allocations, or a native booking and an allocation booking, competing for the same instructor/vehicle/location must not both commit.
- Allocation-backed bookings: DB exclusion constraint prevents two active bookings on the same allocation window.
- Connector-backed bookings: the vendor's concurrency protection is a milestone-4 test (spec 05 §5); locally, events dedupe per DM booking_events, ordered against the **latest accepted authoritative state transition, regardless of state** — the watermark uses the accepted **provider revision or provider occurrence time**, never local transition timestamps. Conflicting events with equal timestamps, or missing/unreliable ordering information, trigger authoritative-state retrieval (`getAuthoritativeState`), not guessed application; state and watermark update together.
- Rescheduling: release old assignments and reserve new ones **atomically** (single transaction); eligibility re-validated; the booking's `commitment_route` distinguishes instant-control routes (connector/allocation/native — re-atomically swap) from `external_manual` commitments (the school re-commits externally; DriveLinkUp records the outcome, it does not simulate authority); on connector routes, a reschedule that cannot be confirmed atomically must roll back.

## 7. Native and allocation operational workflows (capability flags are not the workflow)

**Native (School Booking Workspace):** create availability (recurring + overrides) → school accepts/protects inventory → booking holds resources (DM holds, TTL) → **system confirmation** (policy re-validation + atomic hold commit, §2) → release on expiry/cancel → reschedule re-validates eligibility and re-atomically swaps assignments.

**Allocation (verified inventory slice):** school creates allocation for an offering → **controller accepts** (accepted_at) → student instant-books against it (hold) → system confirmation consumes the allocation ('consumed') → withdrawal by controller releases future bookability. An unaccepted allocation backs nothing. **E4 recognizes an allocation already held by the same booking** (the hold references the allocation) — it is not a second competing claim.

**Allocation-vs-external-diary rule:** local resource exclusion prevents internal conflicts; it cannot prevent a school's external diary from selling the same slot. Controller acceptance therefore requires an explicit acknowledgment that the protected window is blocked in the school's authoritative diary (recorded with the allocation acceptance) — external double-sale of a protected slot is a school-side breach handled by the cancellation policy, and the reconciliation/ops flow surfaces it when detected.

## 8. Earnings view (scoped)

- `earnings_entries` populated **only from authoritative payment, refund, commission, and settlement records** (NN6). External-checkout amounts and payout status remain unknown until those records are ingested and reconciled; the UI must not imply otherwise. Whole-school accounting is out of scope.
- Widget pricing note (action): the school-distributed widget books `school_direct` at 0 kr acquisition commission — the live pricing page currently describes 10% on DriveLinkUp bookings. The terms/pricing pages need an explicit, consistent widget attribution statement **before** the widget ships (R9 gate).

## 9. Reconciliation job

- Compares DriveLinkUp bookings against connector-authoritative state (via the connector's `getAuthoritativeState` operation, spec 05 §2).
- Conflicts raise ops alerts within a defined window (default: hourly during business hours, daily otherwise). Never auto-resolves; a human confirms. Never overwrites the **latest accepted authoritative state of any kind** — not merely confirmed states.
- Staleness detection: exceeded staleness window → instant booking disabled for that school until authority restored (spec 05 §6).

## Acceptance scenarios (Given/When/Then)

- **BK-1 (calendar_sync only):** Given a school with only `calendar_sync`, when a student views its offering, then mode is request-to-book and no instant CTA renders.
- **BK-2 (transaction_capable):** Given a school with `transaction_capable` from a milestone-5 connector, when a student books, then the booking may reach `confirmed` only via the connector's authoritative confirmation event and E1–E3 pass.
- **BK-3 (allocation):** Given an accepted allocation, when two concurrent instant bookings target it, then exactly one succeeds (exclusion constraint) and the other receives a structured E4 error.
- **BK-3b (cross-allocation resource conflict):** Given two distinct accepted allocations for the same resource and overlapping windows, when concurrent instant bookings target each, then exactly one commits (resource-level conflict rule, DM).
- **BK-4 (native):** Given a school with completed workspace onboarding, when a booking is created in the native calendar, then policy checks E1–E3 are enforced, a hold is created, and resources are assigned via booking_resource_assignments.
- **BK-5 (request-to-book acceptance):** Given a request on a `manual` school whose permit expires before acceptance, when acceptance is attempted, then acceptance is blocked (E1 fails at re-evaluation) with a per-component error.
- **BK-5b (manual acceptance needs no connector):** Given a request on a `manual` school with all checks passing, when the school accepts and records a commitment route, then the booking reaches `confirmed` without any vendor connector.
- **BK-6 (dedupe):** Given a connector sends the same event twice, when ingested, then exactly one booking change applies.
- **BK-7 (out-of-order):** Given a newer cancellation followed by an older confirmation for the same external_ref, when the older event is processed, then it is recorded `rejected_stale` and the cancelled state stands.
- **BK-8 (late payment):** Given a payment captured after TTL expiry, when processed, then the booking stays `expired`, the payment is flagged `late_captured`, an ops task is created, and no automatic confirmation occurs.
- **BK-9 (reschedule atomicity + revalidation):** Given a reschedule, when executed, then eligibility is re-validated, old assignments release and new assignments commit atomically (no window with both held or neither).
- **BK-10 (attribution):** Given a widget booking, when commission runs, then `origin = school_direct` is assigned from the server-side registered widget token and 0 kr acquisition commission applies.
- **BK-11 (local instant confirmation):** Given a native/allocation instant booking with valid active holds and all policy checks passing, when the system confirmation transition runs, then pending → confirmed with holds committed to assignments atomically in one transaction; with a failed re-validation, then the transition is blocked with a per-component error.
- **BK-12 (ambiguous event order):** Given connector events with equal provider timestamps or missing ordering data for the same booking, when processed, then no event is applied by guess — the authoritative state is retrieved via `getAuthoritativeState` and the outcome is reconciled from it.
- **BK-13 (allocation diary acknowledgment):** Given a controller accepting an allocation, when acceptance is recorded, then an explicit acknowledgment that the protected window is blocked in the school's authoritative diary is captured with the acceptance.
- **BK-14 (saleability bypass):** Given a school with valid permit evidence but an unresolved representative-authority gate (or a suspended/inactive offering), when a direct request-submission or instant-booking API call is made, then it fails with an E0 error and no booking is created; and given the same school with E4 absent but all other checks passing, then a request-to-book submission succeeds.
- **BK-15 (resource bundle, instant only):** Given an **instant** booking creation for an offering requiring an instructor and a vehicle, when processed, then the server derives the end time from the offering's duration and buffers, evaluates E2 against the actual assigned instructor, and atomically reserves the complete bundle (instructor + vehicle + location) — if any required resource is unavailable, no partial hold is created and the request fails with a structured error.
- **BK-16 (request path holds no resources):** Given a **request-to-book** submission for the same offering, when processed, then the request is recorded with its requested time and preferences and **no holds are created** — resource commitment happens only at acceptance, against the actual assigned instructor, via the school's recorded commitment route.
- **BK-17 (scope-specific withdrawal):** Given a school whose `request_to_book` scope is withdrawn while `availability_display` remains granted, when the profile is viewed and a request is attempted (including via cached cards, old links, or queued prompts), then the request form and request submission are rejected server-side with an authorization error, the displayed times remain (granted scope), and — for a school with zero scopes — the profile renders directory-only (info + prices; no times, no form, no contact-CTA-as-booking). Withdrawal never blocks cancellation, refunds, or support for existing confirmed bookings.
- **BK-18 (withdrawal survives refresh):** Given a withdrawn authorization, when school data is refreshed or re-imported from any source, then the withdrawal and granted-scopes history persist and no booking surface reappears.
- **BK-19 (no auto-enable):** Given a school with a working connector, verified permit, and active school account but zero granted scopes, when its profile is viewed and booking is attempted via direct API, then it is directory-only and the API returns an authorization error — capability and verification never substitute for authorization.
- **BK-20 (cancellation-policy execution):** Given a school policy "cancel by 13:00 the previous business day" **on an approved Monday–Friday calendar with no holidays**, when a student books a Monday 10:00 lesson, then the cancellation deadline computed for that booking is Friday 13:00 school-local time (not Sunday 10:00) and the policy snapshot attached to the booking records that version. With an unapproved/unknown calendar, no deadline is computed and no booking-dependent checkout proceeds.
- **BK-21 (queued request after withdrawal):** Given a request submitted while `request_to_book` was granted and withdrawn before acceptance, when acceptance or confirmation is attempted, then the action is rejected (authorization re-checked at acceptance/confirmation) while cancellation and refund of any related payment remain available.
