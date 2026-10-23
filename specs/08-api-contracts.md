# 08 — API Contracts (proposed)

**Req ID prefix:** API. Proposed application contracts so Cursor does not invent behavior. Stack-agnostic (REST-shaped; translate to the Gate-0 stack). All mutating endpoints take an `Idempotency-Key` header; all responses scoped server-side by actor membership (AR-5). Errors are structured: `{error: {code, component?, detail}}` — `component` carries the failed eligibility element (E1–E4) where applicable.

## 1. Onboarding (school)

### POST /api/schools — create draft
- Actor: authenticated user (becomes owner via membership).
- Input: `{legal_name, organization_number, country_code, city, profile}`
- Checks: company_exists (register API or manual path per market); duplicates by (country, organization_number) → 409.
- Output: `201 {school_id, listing_status: 'draft'|'pending_verification', next_steps[]}`.
- Idempotency: same key → same school.

### POST /api/schools/{id}/representative-verification — start
- Actor: owner.
- Input: `{eid_broker_redirect}` → returns redirect; callback records identity verification_record.
- Errors: broker unavailable → `503 {code: 'eid_unavailable', fallback: 'manual_review'}`.

### POST /api/schools/{id}/signatory-check
- Actor: owner (after e-ID).
- Input: none (uses verified identity + organization_number).
- Checks: Bolagsverket mode logic (VF-a…a4). Output includes `signing_mode` and required follow-ups:
  - `JA_ENSAM` → pass; `JA_TILLSAMMANS` → `202 {requires: 'co_signature', participants[]}`; `JA_LOPANDE` → `202 {requires: 'scope_review'}`; `JA_FULLMAKT` → `202 {requires: 'mandate_inspection'}` (manual review queue).
- Errors: register unavailable → previously-valid evidence keeps flow, flagged re-check; never-verified → blocked.

### POST /api/schools/{id}/teaching-permit-evidence — submit
- Actor: owner.
- Input: `{method, evidence}` (e-service result ref, dated document hash, or manual submission → review queue).
- Output: `202 {verification_record_id, status: 'pending'}` → review or re-check outcome transitions it.

### POST /api/schools/{id}/instructors — attach
- Actor: owner. Input: `{user_ref, categories}`. Checks: instructor teaching permit + affiliation (B3). Errors per component.

### POST /api/schools/{id}/connection — select vendor-neutral route
- Actor: owner. Input: `{vendor_key?, route}` where route ∈ transaction_capable|read_only|calendar_sync|manual.
- Effects: creates school_connection; transaction_capable only via connector milestone (never directly accepted).
- Output: `201 {connection_id, state: 'pending', delegated_by: user_id}`.

### POST /api/schools/{id}/activate — request listing activation
- Actor: owner. Checks: **onboarding-gate checks first — completed representative identity (identity check on the requesting user), company-register match (company_exists), and signatory-authority outcome (signatory_authority: JA ENSAM pass, or resolved JA TILLSAMMANS/FULLMAKT/LOPANDE follow-up)**; then policy service, activation row (spec 03 §1): E1 (school permit scope), E2 for attached instructors; E4 evaluated **per offering** for instant display — request-to-book offerings activate without a control route. All offerings gated on E1.
- Output: `200 {listing_status}` — 'active' only when gates pass; else `403 {error:{code:'verification_incomplete', component}}` (component includes onboarding-gate failures).

## 2. Verification review (admin console)

### POST /api/admin/review-queue/{item_id}/resolve
- Actor: platform_admin (permissions: review_queue).
- Input: `{decision: 'pass'|'reject', note, evidence_ref?}` — audited.
- Effects: transitions the linked verification_record; re-evaluates affected offerings' activation (gating rules, spec 04 §4).
- Errors: `403` non-admin; `409` already resolved.

### POST /api/admin/recheck/{subject_type}/{subject_id}
- Schedules re-verification for expired/flagged records. Output: scheduled run.

## 3. Offerings

### POST /api/schools/{id}/offerings
- Actor: owner/admin. Input: `{category, lesson_type, price: {amount, currency}, booking_mode_advisory}`.
- Checks: E1 scope covers category; active=false until activation gates pass (NN1).

### PATCH /api/offerings/{id} — changes to price/category re-run scope checks; category changes can disable the offering if the permit scope no longer covers it.

## 4. Availability

### GET /api/schools/{id}/availability?from&to&category
- Actor: public. Output: **consumes the authorization + saleability-gated mode decision (spec 03 §3)** — times and bookable inventory are returned **only when `availability_display` is granted, independently of booking or inquiry permissions**; zero scopes → directory-only response (no times, no inventory, `mode: 'directory_only'`); a school granting only `inquiry_collection` gets an inquiry surface **without times**; E0 or permission-check failure → review/contact state; otherwise the derived booking mode + bookable windows from the strongest applicable control route (allocation/native/connector), else calendar_sync busy intervals, else `contact_only` (authorized).
- Note: response is derived server-side; no client computes mode.

### POST /api/schools/{id}/authorizations — grant/withdraw scopes (school-side or admin via complaints workflow)
- Actor: school owner/admin (authorized representative) or platform admin (recording a school's restriction request). Input: `{granted_scopes[], authorized_by_user_id?, evidence_ref?, withdraw: bool}`. Effects: school_authorizations row + history entry; withdrawal immediately disables the affected entry points server-side. Output: `200 {granted_scopes, state}`.
- **Staff constraint:** platform staff may **suspend or withdraw** disputed scopes from a complaint; **granting or restoring scopes requires fresh evidence from an authorized school representative** (server-side identified — `authorized_by_user_id` is resolved from the authenticated session, never trusted from client input). A school need not complete onboarding to record a restriction.

### POST /api/schools/{id}/allocations — create protected slice
- Actor: owner/admin. Input: `{offering_id, resource_id, window_start, window_end}`. Effects: allocation row, state 'offered'. Conflicts → `409`.

## 5. Bookings

### POST /api/bookings — create (instant or request)
- Actor: student (verified contact). Input: `{offering_id, start_time, resource_preferences?, idempotency_key, guardian_consent_ref?}`.
- **Resource bundle (canonical, mode-specific):**
  - **Instant creation:** the server derives `end_time` from the offering's duration + buffers; required resource types come from the offering definition; **assignment is server-side by default** (eligible instructors/vehicles/locations matched from availability, honoring optional `resource_preferences`); the **complete bundle is reserved atomically** — if any required resource is unavailable, the request fails with `409 {code:'resource_unavailable', missing[]}` and **no partial hold** is created. E2 is evaluated against the actual assigned instructor.
  - **Request submission:** record the requested time and optional `resource_preferences`; create **no holds** and do not imply resource confirmation — the request is a proposal the school accepts or declines. At acceptance, eligibility is re-validated against the actual assigned instructor and the school records its commitment route (spec 03 §1).
- **Cancellation-policy link (canonical):** booking creation attaches an immutable `cancellation_policy_snapshot` and computes `cancellation_deadline` from it (BK-20). **Unknown/unapproved policy → no booking-dependent checkout proceeds** (directory visibility unaffected) — the server never applies a "24 hours" fallback.
- Checks: the **policy service** with action-specific checks (spec 03 §1): instant creation → E0–E4 **plus matching authorization scopes** (`transactional_booking` for instant, `request_to_book` for request submission); request submission → E0–E3 + `request_to_book`. Zero/withdrawn scopes → `403 {error: {code: 'not_authorized_by_school'}}` (BK-19).
- Output: `201 {booking_id, booking_state: 'pending', ttl?, assigned_resources?}`; failure `403 {error:{component: 'E0'|'E1'|'E2'|'E3'|'E4'}}` or `409` resource-unavailable (instant only).
- Idempotency: same key → same booking returned.

### POST /api/bookings/{id}/accept — request acceptance
- Actor: school/instructor (school-scoped role). Checks: acceptance policy (spec 03 §1) — E0–E3 re-evaluated; **E4 not required**; the school records the commitment route (native/allocation/external-manual) or the request stays pending. Output: `200 {booking_state: 'confirmed', commitment_route}` or `409 {component}` (e.g., permit expired meanwhile — BK-5).

### Booking ownership authorization (canonical, all booking mutations)
- **Students** may mutate only bookings where `booking.student_id` = caller (reschedule, cancel, view).
- **School users** require an authorized membership role in that booking's school.
- **Instructors** act via their school-scoped membership; instructor permissions are explicitly scoped to the booking's school.
- **Cancellation-policy eligibility** (tiers, deadlines, refund routes) is evaluated **after** ownership authorization and never substitutes for it.
- Failures: `403 {error: {code: 'not_booking_owner'}}` with no state, resource, hold, or payment changes.

### POST /api/bookings/{id}/reschedule
- Actor: student (own booking) or school user (booking's school). Authorization: ownership rules above. Checks: policy re-validates the rescheduling row (E0–E3 always, E4 on instant paths). Effects: atomic release+reserve (BK-9). Errors: `409 {code: 'resource_unavailable'}`, `403 {error: {component}}`, or `403 not_booking_owner`.

### POST /api/bookings/{id}/cancel
- Actor: student (own booking) or school user (booking's school); authorization per the ownership rules above — cancellation-policy tier eligibility never substitutes for ownership. Effects: state transition + refund route per cancellation-tier policy; resources released.

## 6. Webhook ingestion (connectors)

### POST /api/webhooks/connectors/{connector_key}
- Auth: connector signature/secret per connection.
- Input: raw provider event. Processing per spec 05 §4: record → dedupe (provider_event_id, else payload hash) → order (revision/occurred_at vs the **latest accepted authoritative state transition, regardless of state**) → apply or `rejected_stale`/`rejected_duplicate`.
- Output: `202` **conditional** on authenticated, structurally valid, durably recorded input. Invalid authentication → `401/403`; failed persistence → `5xx` (caller retries); stale/duplicate → `202` with recorded disposition — a successful ingestion of an out-of-order or duplicate fact, not an error.

## 7. Payments boundary

No payment endpoints in this pack — provider TBD (NN6). `payment_records` are ingested from the provider's authoritative records (webhook or reconciliation), never from client input. Late-captured payments follow spec 03 §4.

## Contract-level acceptance

- **API-1:** every mutating route enforces school scope + role server-side (probe with foreign-school token → 403).
- **API-2:** webhook returns 202 for a duplicate and records `rejected_duplicate` (idempotent).
- **API-3:** activation returns per-component errors; no global "verification_failed"; booking-mode responses consume the same E0-inclusive decision.
- **API-4 (ownership):** given another student or a foreign-school user, when reschedule/cancel is attempted on a booking, then `403 not_booking_owner` and no state, resource, or payment changes occur.
- **API-5 (resource bundle, instant only):** given an offering requiring instructor + vehicle with the vehicle unavailable, when **instant** booking creation runs, then the request fails with the structured missing-resource error and no partial hold exists (BK-15). Given the same offering on the **request path**, when a student submits the request, then the submission succeeds and creates **no holds** (the school may still decline at acceptance).
- **API-6 (saleability bypass):** given an unactivated or suspended school/offering, when a direct booking create is attempted, then it fails with an E0 component error and no booking is created (BK-14).
- **API-7 (authorization):** given a school with zero or withdrawn scopes, when booking create is attempted via direct API, then `403 not_authorized_by_school` and no booking, inquiry, or payment entry point succeeds (BK-17/BK-19).
- **API-8 (inquiry-only):** given a school granting only `inquiry_collection`, when availability is requested, then no times or bookable inventory are returned (times require `availability_display` independently) and the inquiry form renders without availability claims.
- **API-9 (availability survives request withdrawal):** given a school with `availability_display` granted and `request_to_book` withdrawn, when availability is requested, then times render normally while request submission is rejected (BK-17).
