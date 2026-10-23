# Master run prompt — full build-out including the supply-acquisition track

The durable version of the master prompt (supersedes the chat-issued variant). Paste the block below into Cursor. It executes the complete build: Phases 1–6 plus the Acquisition track, per `specs/09-scalable-platform-specification.md` (v1.3) and `docs/cursor-workflow.md`.

```
Execute the complete build-out of the DriveLinkUp scalable platform — all phases
plus the acquisition track, per specs/09-scalable-platform-specification.md §13
and docs/cursor-workflow.md.

STATUS: Phase 0 is DONE (docs/v1.2-gap-map.md + the migration plan). Phases 1–3
are merged; Phase 4 is open as a PR. Read docs/cursor-workflow.md and
tasks/todo.md first and resume from the recorded state — never restart completed
work.

OPERATING LOOP — repeat for each remaining phase in order (4 → 5 → 6), and the
ACQUISITION TRACK alongside per its prerequisites:

1. RESUME: read tasks/todo.md. If a phase or ACQ item is in flight, continue it.
   tasks/todo.md is the single progress record: update it as you go.
2. PLAN: Plan mode with a reasoning model. Read the phase's entry in specs/09
   §13 (including the ACQ track), the workflow doc, and the acceptance scenarios
   in §15. Produce a plan mapped to scenarios. No code until the plan is done.
3. EXECUTE: Agent mode, model per the workflow's phase table (Composer 2.5
   default; GPT-5.6 Sol for Phases 3–4). Branch: feat/phase-N-<slug> or
   feat/acq-N-<slug>.
4. VERIFY: record the baseline first (npm test, typecheck, biome). Done = no
   new regressions + the phase's acceptance scenarios covered by tests at
   route/UI level + pre-existing failures reported. Never weaken a test.
5. PR: one PR per phase or ACQ item with the scenario checklist in the
   description. Do not merge unless I explicitly authorize merging.
6. GATE: start the next phase only after the current PR is merged and its
   done-conditions hold.

ACQUISITION TRACK (specs/09 §13 ACQ; docs/acquisition-strategy.md):
- Priority order: ACQ-1 claim-listing funnel (with the category model shared
  from the start — no B-only claim flow) → ACQ-3 school-mediated instructor
  onboarding → ACQ-2 lead dashboard → ACQ-4 professional-category supply
  (A motorcycle, C truck, D bus) → ACQ-5 concierge tooling.
- Per-capability prerequisites are in specs/09 §13; tracks are eligible to run
  alongside each other — do not restart or silently expand an in-flight phase,
  and do not run concurrent agents against the same files.
- Hard rules: no seeding before the register route is verified (synthetic
  fixtures for development; documented manual prospecting is the alternative);
  imported candidates private until eligibility checks; claim verification
  grants no commercial scopes; no independent instructor publication/selling;
  one approved active policy per listing, category-specific selection per
  offering, immutable booking snapshots.
- BOUNDED EXECUTION (docs/acquisition-strategy.md §6): you may build onboarding
  surfaces, claim flows, private prospect management, analytics/lead tooling,
  attribution and pilot-reporting tools, category taxonomy/filters, draft
  offerings/policy tooling, campaign/playbook drafts, and synthetic-fixture
  tests. You may NOT send outreach, publish imported listings in bulk, spend on
  acquisition, contact vendors, or activate production capabilities — and
  software completion is never reported as supplier-acquisition success.

- OUTREACH IDENTITY: all outreach email is sent from
  marketing@drivelinkup.com (Google Workspace; subscription confirmation
  pending) with the signature exactly: frank - founder of drivelinkup.com.
  Until the mailbox is live, no outreach is sent. Every outreach draft,
  template, and playbook you build must carry this from-address and signature;
  sending itself remains a separately authorized human action.

HARD RULES (every phase and ACQ item):
- specs/09 is the implementation authority; .cursor/rules/drivelinkup.mdc
  (rules 1–24) and AGENTS.md invariants apply always. Conflicts: record and
  surface — never improvise.
- Ship dark: every behavior change behind a feature flag defaulting OFF;
  additive schema changes only (merges run prisma db push against production).
  The founder flips flags, never you. Recorded withdrawals always take effect,
  even while flags are OFF.
- Never delete bookings, financial history, or authorization events. No vendor
  contact, no partner invitations, no production data changes.
- Phase 6: build milestone-4/5 test harnesses and tooling only; real
  vendor-environment tests and certification stay blocked on a partner.

STOP CONDITIONS — halt and report, do not improvise:
- An acceptance scenario can't pass without changing the spec.
- A spec/rules/AGENTS.md conflict you can't resolve from the documents.
- Anything needing founder, legal, vendor, or payment-provider decisions.
- Two consecutive failed approaches on a sub-task.

Report at every phase/ACQ boundary: what was built, the SC checklist
(pass/fail each — now SC-1…25), test results vs baseline, PR link, open
questions.
```
