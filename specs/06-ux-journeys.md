# 06 — UX Journeys and Screen Requirements

**Req ID prefix:** UX. Swedish-first; all strings through i18n (fixes B5).

## 1. Student discovery (existing — [OBSERVED-MVP])

Filters: category, city, price, rating, availability, school-vs-independent, English, geolocation; sorting; comparison. Availability display must follow capability flags (B6 fix): profiles show "Nästa lediga tid" only where the derived booking mode is instant; otherwise request-to-book CTA or "Kontakta oss om tider."

## 2. Student booking

- **Authorization-first:** the profile surfaces only what the school has authorized (DM `school_authorizations`). **Directory-only** (zero scopes): information and prices only — no times, no request form, no contact CTA presented as booking. For a directory-only school the school's own published contact details may be shown as plain factual information, never wrapped in a DriveLinkUp lead form.
- **Instant:** only where a control route applies **and the school granted `transactional_booking`** (spec 03 §3). Post-booking states shown match the state machine.
- **Request-to-book:** existing request form (fix i18n raw keys), only where the school granted `request_to_book`. No charge up front.
- **Recipient clarity (canonical):** wherever an authorized inquiry/request form exists, the form identifies **DriveLinkUp as the recipient before submission** — it must not imply delivery to, acceptance by, or action on behalf of the school.
- **Payment clarity:** wherever payment is collected, the UI states who receives the payment and when the booking becomes confirmed; nothing may imply the school receives or processes the payment unless that is the recorded route.
- **Brand representation:** school names, logos, and brand assets are used for identification only. No "partner," endorsement, booking-agent, or equivalent implication without a supporting authorization record. **Logos and other brand assets require a separately documented rights basis** — a school's consent to display its information and prices does not extend to brand assets; where no rights basis exists, render text identification only.
- **B4 fix:** third-party review content (ratings/counts, Google Maps link) is removed or replaced with transaction-verified reviews until the rights basis is documented. Placeholder must not claim unverifiable ratings.
- **Student verification:** verified contact required for booking confirmation (Twilio); e-ID optional; a failed Twilio verification blocks confirmation, not browsing (VF-e).
- **Guardian flow (minors):** per-market; completes without student e-ID (VF-g); consent scope explicit (account creation, booking, data processing).
- **Cancellation policy display:** the profile shows the school's approved policy **verbatim** (DM cancellation_policies, active version). Unknown policy → no policy is displayed (never a platform-invented "24 hours" default); for directory-only schools the booking-policy presentation is removed entirely rather than shown with a warning.

## 2A. The request-to-book journey (student and school sides — canonical per spec 09 §6.5)

**Student side:**

1. **Request CTA** — on an offering eligible for request booking (offering eligibility per the policy service; the `request_to_book` scope alone does not guarantee a bookable offering), the profile shows the request form (times only where `availability_display` is also granted, and **displaying a time is neither a hold nor a confirmation** — no real-time availability is promised). The form identifies DriveLinkUp as the recipient before submission (UX-5); the school's approved cancellation policy renders verbatim and is **snapshotted at request creation**; **no charge on request submission** (any later checkout follows the separate payment permissions and checkout contract — nothing implies automatic charging after acceptance).
2. **Submission checks** — E0–E3 run at request submission (spec 09 §6.1): a failed required component prevents successful request creation and shows the relevant error; browsing stays available. Guardian flow for minors per market (VF-g). Success copy is receipt-honest: **"Request saved by DriveLinkUp; awaiting school review"** — it does not imply guaranteed delivery, guaranteed review, or acceptance by the school.
3. **Pending state** — the student's booking list shows the request as `pending` (not a reservation — no resources are held) with cancellation available while pending (state machine: `pending → cancelled` before confirmation). Idempotent submission retries and notification-delivery retries remain legitimate (§6.4) — they are not rebookings.
4. **Outcomes** — **accepted** (booking confirmed with its policy snapshot; any checkout follows the separate payment permissions and payment-state contract — **acceptance alone never shows as paid, and payment is not booking confirmation**); **cancelled by the school before confirmation** (the decline route — there is no separate `declined` state); **expired**, only where a defined response deadline applies to the request (the instant-booking hold TTL is not assumed for requests). An expired request is never automatically reopened or rebooked; the student's path is a **new** request, which reruns the applicable checks and resurrects nothing.

**School side (dashboard):**

1. **Lead arrival** — the request shows the student's verified status, requested time, offering, and the policy snapshot. The dashboard **never mirrors or claims to sync the school's external diary** — no double-managed diary (spec 09 §5).
2. **Commitment depends on the route** — for `external_manual`: the flow instructs the school to **record the reservation in its own authoritative diary before accepting** (manual checking reduces double-booking risk; it is not an atomic check, and the UI must not imply the platform verified availability). For native/allocation routes: commit the applicable resources through the platform's conflict checks (§6.3). **No recorded commitment route means the request stays pending** (SC-16).
3. **Accept** — requires a school-scoped role; re-validates `request_to_book` authorization and E0–E3. Withdrawal is **scope-specific**: only a `request_to_book` withdrawal (or suspension of the relevant booking action) blocks acceptance — withdrawing `availability_display` or `inquiry_collection` does not. When blocked, the block is visible, never silent, and the UI does not invent a cancellation or confirmation transition.
4. **Decline** — maps to `pending → cancelled` (cancellation before confirmation, school actor). Decline-reason categories are a **proposed UX addition** (not existing implementation): honest reasons, terminal for that request, student notified without exposing the school's diary details.
5. **Payment is separate** — the dashboard shows booking state and payment state as separate facts; acceptance never marks a booking paid.

**School withdrawal after submission:** if `request_to_book` is withdrawn or the relevant booking action is suspended, acceptance is blocked visibly; the UI does not invent a cancellation or confirmation transition, and existing confirmed bookings keep their cancel/refund/support lifecycle paths (SC-4) — withdrawal messaging must not imply otherwise.

## 2B. Risk-course discovery journey (Risk 1 / Risk 2 — canonical per spec 09 §9A)

**Student side:**

1. **Discovery pages** — `/riskettan/[city]` and `/risktvåan/[city]` (following the existing `/trafikskola/[city]` convention; localized through the app's existing i18n mechanism), server-rendered, listing providers with upcoming **dated sessions, remaining seats, and prices**, filterable by municipality and date. Prices are the school's approved values; remaining seats are displays — no hold or confirmation is implied. An `external_manual` session shows **unknown availability** (not a synchronized seat count) unless valid provenance/freshness exists — the request path is always available.
2. **Session → request** — the request-to-book journey (§2A) applies verbatim: E0–E3 at submission, receipt-honest copy, pending state (not a reservation; **pending requests consume no seats**), outcomes mapped to the real state machine, no charge on submission.
3. **Action paths follow the school's scopes independently** — times/availability only with the display authorization; requests only with `request_to_book` and E0–E3; instant only with the transactional scope and all eligibility checks including E4. A shared session never becomes unavailable merely because the first participant booked.

**School side:** publish dated sessions with capacity and approved per-participant price (or approve ACQ-imported drafts, which never auto-publish and never bypass the provider permit-evidence gate — SC-26); requests arrive and are handled exactly as §2A; a committed booking consumes a seat through the platform's capacity-aware conflict rules or records `external_manual` per §2A.

## 3. School onboarding (the verification-centric journey)

```
1. Company details → company_exists check (register API or manual)
2. Representative e-ID (broker) → identity check
3. Signatory/authority check → Bolagsverket mode logic (VF-a…a4):
   JA ENSAM → proceed; JA TILLSAMMANS → collect co-signatures/delegation;
   JA LÖPANDE → documented scope review; JA FULLMAKT → manual mandate inspection
4. Teaching-permit evidence (Transportstyrelsen workflow; dated evidence)
5. Instructors: individual approval + school affiliation (B3 fix)
6. Capability/connection selection (vendor-neutral, spec 05 §8)
7. Listing review → listing_status: active only when verification gates pass (NN1)
```

- Review queue (admin console): not-found and ambiguous cases route to manual review — never silent rejection or silent permission (NN3).
- Claim alignment (B2 fix): homepage and FAQ copy must match stored-evidence reality exactly; "Verifierad/auktoriserad" badges render only from stored evidence (date + method).

## 4. School dashboard (scoping note)

The MVP dashboard internals were not inspected ([OBSERVED-MVP boundary]). This iteration adds: capability flags view, connection status per vendor route, verification status per check with expiry/re-check dates, booking list with origin/ingestion columns.

## 5. Instructor journey

- Signup requires school affiliation **and** documented individual approval where rules require both (Sweden: yes — Lag 1998:493). The "körkort 5 år" criterion is removed as a certification claim (B3 fix).
- Instructor badge (verified) requires positive instructor-permit evidence (per-market rules; VF-i for Finland, VF-j for Denmark).

## 6. Earnings surface (scoped)

- Shows only authoritative-record-derived entries (spec 03 §8). UI must not imply whole-school accounting.
- Payout status shown from authoritative settlement records only.

## 7. Growth surfaces (this iteration)

- **R8 cancellation-slot alerts (hypothesis):** opt-in follow (explicit consent); cancelled lesson → instant alert → one-tap rebooking; cooldown rules prevent duplicate alerts for the same slot; a rebooking attempt re-validates E1–E4 (eligibility is never assumed from the alert). Measured as a growth hypothesis.
- **R9 widget:** embeddable page per school; `origin = school_direct` assigned **server-side from the school's registered widget token** — never from a client-controlled parameter; 0 kr acquisition commission. **Gate:** pricing/terms pages updated with the widget attribution statement before ship (spec 03 §8).
- **Referrals after completed lessons:** measured, attributable, capped.

## 8. Admin console

- Review queue (open/resolved/rejected with reasons), re-check scheduler view, connector milestone dashboard, reconciliation conflict view, ops tasks, audit log surface, **school-authorization registry** (granted scopes, history, withdrawal) and **school-complaints workflow**. All admin actions audited (DM audit_log).

**School-complaints workflow (canonical):** a school complaint or restriction request (1) is recorded as an ops task with the requested restrictions; (2) **suspends the disputed functions immediately** (authorization scopes set accordingly); (3) is verified corrected on the live surface; (4) requires **fresh affirmative authorization** from the school before any disputed function is re-enabled. Future reconsideration invited by a school is recorded as a note, never as present authorization. No response-time promises are invented.

**Growth metrics (definitions + recorded events — canonical):**

| Metric | Definition | Recorded events |
|---|---|---|
| Connected-school activation rate | schools with ≥1 active control route ÷ onboarded schools, per month | school_connection state changes |
| Published bookable hours | sum of accepted-allocation + native-published bookable windows in the period | allocations accepted/withdrawn; availability published |
| Booking fulfilment rate | bookings reaching `completed` ÷ bookings reaching `confirmed` | booking_state_transitions |
| Connection failures per 100 bookings | connector errors + staleness degradations ÷ bookings × 100 | booking_events processing failures; staleness flags |
| Supplier retention | schools still active after 90 days ÷ cohort | listing_status history |
| Support minutes per booking | support time logged ÷ bookings in period | ops_tasks resolution records |
| Contribution per booking | retained platform commission/fee revenue per completed booking (gross commission recorded on earnings_entries) minus **platform-borne** variable costs where recorded; school-side costs and unrecorded costs stay unknown and are never invented as "contribution" | payment_records + earnings_entries |
| R8 alert funnel | alerts sent → rebookings attempted → rebookings confirmed | alert + rebooking events |
| Widget attribution (R9) | bookings by origin (school_direct vs marketplace) | bookings.origin |

Instrumentation for each metric is part of the phase that builds the surface (07 delivery plan).

## Acceptance scenarios

- **UX-1:** Given a school whose verification is pending, when its public profile is viewed, then no bookable offering CTA renders (contact only).
- **UX-2:** Given the i18n booking form, when rendered in any locale, then no raw keys appear (B5).
- **UX-3:** Given a school whose permit evidence is unexpired during a temporary directory outage, when viewed, then the offering stays live, flagged for re-check in admin.
- **UX-3b:** Given a school whose permit is confirmed expired/revoked, when gating runs, then the affected offering is disabled pending resolution (per VF-c) — it does not stay live.
- **UX-4 (directory-only):** Given a school with zero granted scopes, when its profile is viewed, then information and prices render with no times, no request form, and no contact CTA presented as booking (BK-17).
- **UX-5 (recipient labeling):** Given an authorized request form, when rendered, then DriveLinkUp is identified as the recipient before submission and nothing implies the school receives or accepts it.
- **UX-6 (student request journey):** Given a submitted request on an eligible offering, when the student views their bookings, then the request renders as `pending` (not a reservation; no resources held), cancellation is available while pending, the policy snapshot from creation is shown, no charge is presented on submission, and the success copy says the request was saved and awaits school review — implying nothing about delivery, review, or acceptance.
- **UX-7 (school accept flow):** Given a pending request, when the school accepts, then the flow requires a school-scoped role, revalidates `request_to_book` and E0–E3, and requires a commitment route — for `external_manual` instructing the school to record the reservation in its own diary first; for native/allocation routes committing through the platform's conflict checks; with no route the request stays pending (SC-16) — and never implies the platform verified availability or that acceptance equals payment.
- **UX-8 (withdrawal visible and scope-specific):** Given a school that withdrew `request_to_book` (or suspended the relevant booking action) after a request was submitted, when the school or student views the request, then acceptance is blocked and visibly so — never silently — while a withdrawal of `availability_display` or `inquiry_collection` does not block acceptance; the UI invents no cancellation or confirmation transition, and existing confirmed bookings keep their lifecycle paths (SC-4).
- **UX-9 (risk-course supply and eligibility consent):** Given an ACQ-imported or school-published risk-course draft session — including one whose provider lacks stored Transportstyrelsen risk-training permit evidence — when it is stored, then it never auto-publishes, production shows no synthetic sessions, and `RISK_COURSES` off hides the public surfaces without removing existing-booking support (SC-26).
- **UX-10 (risk-course honest discovery and scope-specific booking):** Given a school-published risk-course session with seats remaining, when the student views the municipality page and books, then dated sessions, remaining seats, and approved prices render as displays, `external_manual` sessions show unknown availability rather than a synchronized seat count, and the action path follows the school's scopes independently — request-to-book by default (§2A), instant only with the transactional scope and all eligibility checks including E4 (SC-27). Pending requests consume no seats; a committed booking consumes one seat atomically and idempotently, and a shared session never becomes exclusively unavailable after the first participant books (SC-28).
