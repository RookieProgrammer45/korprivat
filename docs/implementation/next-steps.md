# Next steps — build complete; rehearsal then founder decisions

**Status (2026-10-24):** specs/09 v1.3 is fully implemented — Phases 0–6, ACQ-1…5, and the Phase 5 alerting/cutover-runbook slice are on `main`; the suite is green (342/342). What remains is one buildable piece (the rehearsal below) and founder decisions. **Cursor does not flip production flags, contact vendors, or decide open questions without a named founder authorization — one flag at a time, by name.**

## 1. Cutover rehearsal (Cursor executes this now)

```
Execute the cutover rehearsal from docs/v1.2-cutover-runbook.md — in a NON-PRODUCTION
environment only. Do NOT flip any production flag; the founder decides flips one at a time.

1. For each flag in runbook order: enable it in the test environment, run the full suite
   plus the route-level acceptance scenarios (SC-1…25), and record the outcome.
2. Produce a production readiness report:
   - For step 1 (SCHOOL_AUTHZ_ENFORCEMENT): list every live school and its authorization
     state — exactly which schools would go directory-only at flip, and which confirmed
     bookings keep their cancel/refund/support lifecycle paths.
   - For each later flag: the expected blast radius and its preconditions (e.g. step 2
     requires at least one active approved cancellation policy).
3. Report gaps as gaps — do not fix anything without instruction.
4. Open a PR with the rehearsal script and the readiness report.
```

## 2. Founder decision order (recommended — the founder decides)

Each flag is a separate decision (docs/v1.2-cutover-runbook.md). The recommended order, chosen to collect school authorizations *before* enforcement changes live behavior:

1. **Acquisition-surface flags first (runbook step 6):** `CLAIM_FUNNEL`, `SCHOOL_MEDIATED_INSTRUCTORS`, `LEAD_DASHBOARD`, `CATEGORY_OFFERINGS`, `CONCIERGE_ONBOARDING`. These change no live booking behavior — they switch on the funnel that collects school authorizations (claim flow + concierge cohort). This is the operational prerequisite for step 1: flipping `SCHOOL_AUTHZ_ENFORCEMENT` before schools have documented authorization makes every unauthorized school directory-only in one moment.
2. **Record the commission/refund decision** (pro-rata vs clawback — specs/09 §17 open question 7) before any booking-behavior flag flips. Founder decision, one line, recorded in the plan.
3. **Continue the EasyWeek thread** (replied 2026-10-23, vendor-reported: API + webhooks via a paid Developer Module, offered free to customers DriveLinkUp refers; docs at developers.easyweek.io). This is the Phase 6 vendor candidate — milestone 4/5 vendor-environment tests and certification unblock only after terms are actually discussed. Outreach identity: new outreach from marketing@drivelinkup.com once live; this thread continues where it started.
4. **Then the remaining flags one at a time, per the runbook order,** with the rehearsal report in hand: enforcement → cancellation-policy → reliability → connectivity → certification → ops-alerting. Watch the blast radius between flips.
5. **Parallel, external:** payment-provider terms, legal review (marketplace terms, partner agreements, DPAs), register/e-ID access per market, and the Google Workspace confirmation for marketing@drivelinkup.com.

## 3. After each founder authorization (Cursor's verification role)

When the founder names a flag: (a) verify the runbook preconditions hold; (b) confirm the flip — the env var is set in Vercel by the founder or an authorized operator, **not by Cursor**; (c) run the post-flip verification: the route-level acceptance scenarios for the affected surfaces, watch `/dashboard/admin/ops-alerts` once `OPS_ALERTING` is on, and report anomalies honestly (an empty partner directory is not a failure — nothing in this build promotes a partner to CERTIFIED). Rollback is the same env var back to unset/`0`; recorded withdrawals, quarantines, financial history, and authorization events survive a flag-off.
