# Next steps — build complete; rehearsal then founder decisions

**Status (2026-10-24):** specs/09 v1.3 is fully implemented — Phases 0–6, ACQ-1…5, and the Phase 5 alerting/cutover-runbook slice are on `main`. The cutover rehearsal (#41) and the staging flag-on walkthrough (#42) are on `main`. **Cursor does not flip production flags, contact vendors, or decide open questions without a named founder authorization — one flag at a time, by name.** `RISK_COURSES` is a new default-OFF flag (specs/09 §6.6). Do not enable it in production without a named authorization.

## 1. Cutover rehearsal (done — #41) and staging walkthrough (done — #42)

Reports: `docs/v1.2-cutover-readiness.md`, `docs/v1.2-production-readiness-walkthrough.md`.
Collection-plan §10 tooling: `npm run cohorts:assign` writes the worklists and the §6 coverage report from the roster. The current roster has no teaching categories, so 634 schools are unclassified and usable supply is zero. No production flag was flipped.

## 2. Founder decision order (recommended — the founder decides)

Each flag is a separate decision (docs/v1.2-cutover-runbook.md). The recommended order, chosen to collect school authorizations *before* enforcement changes live behavior:

1. **Acquisition-surface flags — only after verified behavior, each separately approved** (runbook step 6): `CLAIM_FUNNEL`, `SCHOOL_MEDIATED_INSTRUCTORS`, `LEAD_DASHBOARD`, `CATEGORY_OFFERINGS`, `CONCIERGE_ONBOARDING`. The rehearsal found tests resetting environment flags, so flag-on behavior is not established by the green suite — enable each named flag only after a staging walkthrough verifies it. Then run the **school authorization collection plan** (`docs/authorization-collection-plan.md`): staging walkthrough → capacity-limited pilot → outreach (from marketing@, after Workspace confirmation + channel approval) → measured thresholds → the enforcement go/no-go with hard gates, commercial thresholds, refreshed snapshots, and the roster delta.
2. **Record the commission/refund decision** (pro-rata vs clawback — specs/09 §17 open question 7) before any booking-behavior flag flips. Founder decision, one line, recorded in the plan.
3. **Continue the EasyWeek thread** (replied 2026-10-23, vendor-reported: API + webhooks via a paid Developer Module, offered free to customers DriveLinkUp refers; docs at developers.easyweek.io). This is the Phase 6 vendor candidate — milestone 4/5 vendor-environment tests and certification unblock only after terms are actually discussed. Outreach identity: new outreach from marketing@drivelinkup.com once live; this thread continues where it started.
4. **Then the remaining flags one at a time, per the runbook order,** with the rehearsal report in hand: enforcement → cancellation-policy → reliability → connectivity → certification → ops-alerting. Watch the blast radius between flips.
5. **Parallel, external:** payment-provider terms, legal review (marketplace terms, partner agreements, DPAs), register/e-ID access per market, and the Google Workspace confirmation for marketing@drivelinkup.com.

## 3. After each founder authorization (Cursor's verification role)

When the founder names a flag: (a) verify the runbook preconditions hold; (b) confirm the flip — the env var is set in Vercel by the founder or an authorized operator, **not by Cursor**; (c) run the post-flip verification: the route-level acceptance scenarios for the affected surfaces, watch `/dashboard/admin/ops-alerts` once `OPS_ALERTING` is on, and report anomalies honestly (an empty partner directory is not a failure — nothing in this build promotes a partner to CERTIFIED). Rollback is the same env var back to unset/`0`; recorded withdrawals, quarantines, financial history, and authorization events survive a flag-off.
