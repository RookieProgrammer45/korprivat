# School authorization collection plan — pre-enforcement

**Purpose:** collect documented school authorizations (scope grants) so the enforcement flip preserves a working, honest marketplace. Per specs/09 §1, a grant exists only as the school's own recorded decision by a **verified representative** — legacy `bookingMode` values, certified-partner pushes, email replies, and owner logins are never grants. **Status: [PROPOSED] preparation — no flag flips, no outreach sends, no vendor contact without separate founder authorization.**

**Where this sits:** between the acquisition-surface prerequisites (runbook step 6 — enabled one at a time, only after verified behavior and separate approval) and the enforcement flip (runbook step 1). Companions: `docs/v1.2-cutover-runbook.md`, `docs/cutover-school-roster.json`, `docs/acquisition-strategy.md`.

---

## 0. Blocking prerequisite — prove collection works before relying on it

The plan assumes the claim → verification → scope-decision → grant flow works **while enforcement remains OFF**. That has not been demonstrated. Before cohort 0, one **staging walkthrough** must:

1. Use an available verification or approved manual-review route — not assumed e-ID access (per §8 access status).
2. Verify representative authority and record a **separate, explicit scope decision** — no inferred or automatically selected scopes.
3. Persist the grant with `SCHOOL_AUTHZ_ENFORCEMENT` OFF.
4. Prove tenant isolation, withdrawal, and contact-restriction preservation in the same walkthrough.

If a prerequisite is missing, it is recorded as **blocked** — this plan does not quietly expand into implementation. Note: the rehearsal found tests resetting environment flags, so "all acquisition flags are safe to flip first" is **not established** — each named flag is enabled only after its behavior is verified and separately approved.

## 1. Starting state (snapshot 2026-10-24 — refresh immediately before any go/no-go)

- **635 school listings.** 1 directory-only (Sjöbo Trafikskola, `contact` — stays restricted; not a collection target). **634** carry legacy `instant`/`request` with **zero grant events**.
- **No live bookings** in the current snapshot (one `cancelled_full_refund`); pending requests and payment states are included in the pre-flip refresh.
- **Tooling built and dark:** claim funnel (ACQ-1), concierge drafts (ACQ-5), school-mediated instructors (ACQ-3), lead dashboard (ACQ-2) — behind runbook step 6 flags.
- **Enforcement is a global flag** (an environment variable; no per-city or per-listing dimension exists in the codebase). Therefore: **cohorts stage outreach, not enforcement** — there is no city-by-city technical rollout.

## 2. What a grant requires (mechanics)

Per school, a verified representative makes an **explicit, per-scope decision** — scopes are **independent choices, not a ladder**: time display (`availability_display`), inquiry collection, request-to-book, and transactional booking are separate permissions; a school may hold any combination. Two paths, same gate:

- **Self-service claim (ACQ-1):** claim link → identity verification (available route) → company/mandate checks (§8) → representative authority → **a scope-choice form with nothing pre-selected**.
- **Concierge (ACQ-5):** we prefill the draft; the school approves or corrects. Approval is still theirs — the tooling cannot manufacture it (SC-25).

Grants are append-only events with `evidenceRef`, `decisionVersion`, timestamp. **Restoration is not automatic:** a fresh grant does not bypass a complaint restriction, representative review, an approved policy, legal eligibility, or inventory authority — and the existing `contact` restriction specifically **cannot** be lifted by an ordinary grant. Whether an email reply can serve as evidence depends on the approved evidence route and verified representative authority; a reply never auto-creates a grant. A school that asks for booking removal gets an immediate withdrawal — honored the same day; that is a documented decision too.

## 3. Cohorts and sequence

Cohorts stage **outreach order**, with assignment precedence and deduplication (a school appears in exactly one cohort; unclassifiable schools go to an explicit unclassified queue when roster fields are insufficient):

| Priority | Cohort | Assignment |
|---|---|---|
| 1 | **0 — pilot cell** | one city/category cell, **capacity-limited batch first** (a proposed ceiling of 10–15, not an upfront commitment — start smaller, measure review minutes, then release the remainder) |
| 2 | **1 — professional categories** | A (motorcycle), C (truck), D (bus) schools (founder priority, plan §9A.3) |
| 3 | **2 — active core** | remaining schools with published offerings/availability |
| 4 | **3 — long tail** | the rest |

Non-responders: directory-only at flip is a legitimate outcome (the Sjöbo lesson — booking is the school's choice). After the cadence, the school stays listed with a claim path; **collection establishes permission, it does not pressure schools into granting it**.

## 4. Outreach

- **From:** `marketing@drivelinkup.com`, signature exactly: `frank - founder of drivelinkup.com`. **Blocker: no outreach — email or telephone — until the Workspace confirmation lands, the mailbox is connected, and the founder approves the channel.** Cohort *preparation* (worklists, drafts) has no mailbox dependency; contacting schools by any route does.
- **CTA:** the claim link plus the honest proposition — authorization is the school's control: per-scope, revocable, no double-managed diary, no fee to be listed.
- **One cadence:** day 0 / day 4 / day 10, then stop. Immediate suppression after objection or opt-out. No further rounds are a flip prerequisite.
- All school statements recorded as school-reported.

## 5. Review capacity — the throttle

Every claim and mandate check feeds the §8 review queue. Outreach volume ≤ review throughput; if the queue exceeds one week of backlog, the next cohort's send is paused. Set weekly throughput from the pilot batch's measured effort — do not scale outreach past it.

## 6. Measuring actual bookability (not grant counts)

Report five separate buckets — grant counts are **not** usable supply:

1. **Authorized schools, by individual scope** (each scope counted separately).
2. **Action-eligible schools:** applicable E0–E3 checks pass, an approved policy exists, and a usable request-acceptance route exists.
3. **Instant-bookable schools:** the above plus valid E4 (control route) and current inventory.
4. **Availability-display-authorized schools** (times shown, no booking claim).
5. **Directory-only schools.**

Instructors are a **separate count** — never added to school supply figures. Density is measured by municipality × category using **actual eligible offerings**, not legacy modes or grant counts.

## 7. The enforcement decision (hard gates vs commercial readiness)

The zero-live-bookings snapshot reduces booking-migration exposure; it does not make the flip merely cosmetic. Separated:

**Hard readiness gates (all must hold):**
- the §0 staging walkthrough passed (collection/withdrawal paths function; grants persist with the flag OFF);
- authorization correctness verified (tenant isolation, withdrawal, contact-restriction preservation);
- existing-booking lifecycle preservation demonstrated;
- deployment/schema readiness and verified production configuration (the 2026-10-24 incident's lesson: schema and code deploy together);
- inventory handling at cutover demonstrated (below).

**Commercial readiness (founder-selected thresholds, set from pilot data):**
- usable supply density per municipality × category meets the founder's threshold;
- review capacity has runway.

Unsupported booking surfaces do not stay enabled to preserve apparent density — the flip decision is presented **with the roster delta** (exactly which schools go directory-only, per city) and refreshed snapshots (roster, bookings, **pending requests and payment states** — not just confirmed bookings). The founder sees the blast radius before approving.

**Inventory handling at cutover:** legacy slots and historical records are **retained, not deleted**; unauthorized times are hidden from **every public delivery path**; re-exposure or booking requires revalidation (freshness, applicable policy, legal eligibility, control route) — a fresh grant alone never revives stale inventory or proves E4.

## 8. Tracking (operational)

Per school: owner, representative-review status, requested/granted/withdrawn scopes (separately), evidence reference, last contact, next action, suppression reason. Personal verification evidence lives in approved private storage — **never in committed roster files** (the roster JSON holds public listing facts only).

## 9. Sequence

1. Staging walkthrough (§0) — founder approves the named prerequisite flags only after verified behavior.
2. Pilot batch (capacity-limited) — measure time-to-grant, review minutes, drop-off.
3. Workspace confirmation + channel approval → outreach begins, paced by review capacity.
4. Measure → set §7 thresholds → scale cohorts.
5. Go/no-go review: hard gates + commercial thresholds + refreshed snapshots + roster delta → founder decision.
6. Post-flip: watch ops-alerts, keep support paths open, honor removal requests as immediate withdrawals.

## 10. Cursor's buildable support (small, bounded)

- Cohort-assignment script: reads the roster, applies §3 precedence + dedup + unclassified queue, outputs worklists.
- Coverage report: the five §6 buckets, per-city density, roster delta for a hypothetical flip — the go/no-go input.
- Outreach sequence drafts in the concierge tooling (from-address + signature per policy; sending remains a separately authorized human action).

No flag flips, no sends, no vendor contact — founder actions per `docs/implementation/next-steps.md`.
