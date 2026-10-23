# DriveLinkUp supply acquisition strategy — schools and instructors

**Status: [PROPOSED] — founder-approved direction (October 2026), execution bounded per §6.** This document brings the supply-side acquisition strategy into the repository so implementation (specs/09 §13 ACQ track) and operations share one source of truth. Derived from Product Development Plan v5 §9A with the founder's decisions of 2026-10-23: **instructors are school-affiliated, not independent suppliers (legal reasons, at least at first)**, and **the marketplace covers professional licence categories — A (motorcycle), C (truck), D (bus) — alongside car (B)**.

The mechanisms are adapted from the Booking.com supply model (see [Booking.com Connectivity docs](https://developers.booking.com/connectivity/docs)): self-service long-tail onboarding, one-to-many distribution through certified connectivity partners, and demand-led activation. That these caused Booking.com's growth is an interpretation, not a sourced claim. **Acquisition scales the funnel, never the consent** — no vendor, certification, or cohort ever substitutes for a school's own authorization.

---

## 1. Acquisition stages (separate from permissions)

Supplier acquisition is a staged funnel, and the stages are **not** permission grants — scopes stay independent and non-linear (a school may authorize inquiries without displaying times, or request-to-book without ever running inquiry mode):

**qualified prospect → eligible listing → verified representative → explicitly authorized capabilities → first fulfilled booking → retained supplier**

Three decisions stay separate throughout: **directory eligibility** (accuracy, restrictions, rights — no booking onboarding required), **verification badges** (evidence-backed), and **bookability** (authorization scopes + a verified control route). No stage automatically grants a scope.

**Metrics:** prospects identified, listings claimed, representatives verified, capabilities authorized, first fulfilled bookings, repeat bookings, scope-upgrade rate (a school reacting to its own lead data is demand-pull working). **Schools and affiliated instructors are counted separately** — instructor invitations must not inflate "suppliers acquired."

## 2. Segments

**Segment A — schools on national booking systems.** Reached one-to-many through certified connectivity partners; each school still grants its own scopes (a certified partner never implies school consent). Priority: the one or two dominant vendors per market. Transactional cohorts become bookable only after the Phase 6 milestone-5 pilot and external access requirements; availability-only cohorts follow their capability-specific approval path (specs/09 §8). Cost profile: high upfront (certification), low-but-nonzero marginal cost per attached school (connector maintenance, support). The [Swedish TABS sunset](https://tabs.teoricentralen.se/) (31 Dec 2026) is a **re-evaluation window, not an open market** — Teoricentralen is migrating TABS customers to its own successor (TC Admin, automated transfer, personal onboarding). The defensible moves: an opt-in transition-cohort experiment, and a connectivity partnership with the successor system (milestone-gated). Norwegian TABS AS: no integration of the requested kind, none planned near-term [VENDOR-REPORTED] — unsupported; keep warm.

**Segment B — independent schools (own or simple systems).** Direct outreach plus concierge onboarding (a proposed response to test: we prepare the listing data correctly; the school makes the authorization decisions). Request-to-book plus native diary or the calendar-sync tier — no vendor needed.

**Segment C — instructors (school-affiliated; no independent sellers at first).** Founder decision, legal reasons. Instructors join **through their school**: the school invites, affiliation is verified, the listing is school-scoped (the school's permissions, authorized categories, and policies govern what the instructor may offer), and native-diary control applies only to genuinely delegated inventory. The independent-seller model is deferred — revisit only after per-market legal and permission validation. Instructors become a school-level acquisition channel: instructors bring their schools, and their students follow.

## 3. Category coverage: B plus professional licences (A, C, D)

The marketplace covers **A (motorcycle)**, **C (truck)**, **D (bus)**, and combinations/lighter variants (BE/CE/DE, C1/D1) where schools hold them.

- **Category permission is a per-category E1 scope check:** a school's teaching authorization is category-specific. The claim funnel captures each school's authorized categories; an offering may only be published in a category the school currently holds teaching permission for (scope match on legal entity, location, and category — not a category dropdown). A B-only school listing A/C/D offerings is a violation, not a growth tactic.
- **Why professional categories matter:** C/D training is vocational — higher lesson prices, employer-funded and vocational-program demand, and a widely reported truck/bus driver shortage creating demand-pull (**verify demand evidence per market before relying on it in any claim** — hypothesis, not finding). Providers are fewer and more professional (closer to a B2B motion: employers, staffing agencies, vocational programs as referral channels). Motorcycle (A) is a seasonal niche with dedicated schools.
- **Product fit:** the resource-bundle model (instructor + vehicle + location) suits heavy-vehicle and motorcycle training where the vehicle is a defining constraint. Offerings are category-tagged with category-specific policies — **one approved active policy per listing remains the rule (specs/09 §11); a category-specific policy selection applies per offering, and the booking snapshots the applicable policy immutably at creation.**
- **Acquisition axis:** C/D vocational providers and motorcycle schools are distinct prospect lists within Segments A/B; category-specific landing pages (municipality × category) do the demand-pull work.

## 4. Register-based prospecting (access-dependent)

1. **Verify access first:** the public licence register's coverage of schools vs instructors, bulk-reuse terms, and personal-data restrictions must be checked against the official-source matrix before any seeding. If bulk access is unavailable, a documented manual prospecting route is the alternative — never a workaround for access or personal-data restrictions.
2. **Imported candidates stay private** until directory-listing eligibility and data-quality checks pass; **real collection/reuse is blocked until rights are verified — development uses synthetic fixtures.**
3. **Claiming verifies representative authority** — not merely an email or identity match; company/mandate checks apply before any scope decision. Claim verification never itself grants commercial scopes. Imported cancellation policies remain draft/unverified until school-approved (SC-18).

## 5. Demand-pull and measurement

- Every school page is a local landing page (municipality × category × language).
- A lead dashboard: schools see permitted listing analytics and inquiries; the authorization prompt is their own data. A zero-scope school may see analytics and historical inquiries but **must not collect new inquiries without `inquiry_collection`**; lead-to-booking conversion passes the applicable booking permissions and eligibility checks — never merely a scope.
- 0 kr student fee and verified-badge positioning, claims aligned to actual practice.
- Flywheel measured, not assumed: views per listing → inquiry rate → authorization rate → fulfilled bookings → retention.

**Unit economics (internal; commission never appears in outreach artifacts):** per segment and cohort — acquisition cost per activated supplier (outreach, verification, review, onboarding, connector maintenance allocated; self-service is cheap, not free), contribution from attributable completed bookings after variable costs (the commission rate is not contribution margin and does not apply uniformly to school-direct bookings), retention and payback by cohort. Concierge cost recovered within a measured number of fulfilled bookings per school — threshold set from the pilot before scaling concierge. Guardrail: no segment scales past measured cost/contribution until the pilot proves fulfilment — reliable, fulfilled, incremental bookings are the moat, not listing counts.

## 6. Bounded execution (what Cursor may and may not do)

**Cursor may build:** onboarding surfaces, claim flows, private prospect management, analytics/lead tooling, attribution and pilot-reporting tools, category taxonomy and filters, draft offerings/policy tooling, campaign/playbook drafts, synthetic-fixture tests.

**Cursor may NOT (without separate explicit authorization):** send outreach, publish imported listings in bulk, spend on acquisition, contact vendors, activate production capabilities, or treat software completion as supplier-acquisition success. Operational pilot outcomes are **pending until measured** — no invented outcomes. Registers: real collection/reuse blocked until rights are verified.

## 7. Bounded pilot playbook

1. Choose one city/category supply–demand cell with available evidence.
2. Identify eligible prospects via the verified register route (or documented manual prospecting).
3. Assign an owner.
4. Define the outreach CTA and follow-up cadence.
5. Run concierge onboarding.
6. Measure through **first fulfilled booking and repeat activity**.
7. Set expansion thresholds from measured results.

Listing coverage and genuinely bookable supply are measured separately. **Review capacity is the throttle:** the funnel feeds the verification review queue; verification operations must scale with acquisition, or the queue becomes the bottleneck and the honest-claims standard breaks.

## 8. Dependencies (implementation mapping)

| Capability | Prerequisites |
|---|---|
| Claim flow + school-mediated instructor affiliation | Phase 1 (authorization foundations, representative/binding rules) + an available verification or approved manual-review route; **ACQ-1 shares ACQ-4's category model from the start** (no B-only claim flow) |
| Lead dashboard | Phase 1 tenant authorization + separately implemented analytics/inquiry collection |
| Category taxonomy, directory filters, draft offerings | After Phase 1 |
| Active category offerings, resource allocation, policy snapshots, bookings | Phase 2 services + E0–E4 checks |
| Concierge drafting and pilot playbooks | Preparable early; real imports/publication/outreach keep their approval/access gates |
| Transactional vendor-cohort activation | External access + the Phase 6 milestone-5 pilot — not merely completed API tooling |

Tracks are **eligible to run alongside each other** — not an instruction to launch concurrent agents against the same files.
