# Cursor workflow — model-by-phase build of the scalable platform

Operational guide for driving Cursor through the product specification. The build sequence and acceptance criteria are **specs/09-scalable-platform-specification.md §13 and §15** — this document only adds *how to run Cursor per phase* (model, mode, prompts, done-conditions). Model assignments here are **recommendations for the operator** — Cursor does not read or enforce them; you select the model and mode in Cursor yourself. Where this document or older docs conflict with specs/09, **specs/09 wins**. Conflicts between the product specification, `AGENTS.md` invariants, and existing rules are **recorded during Phase 0 and resolved explicitly before the affected implementation begins** — none is silently overridden.

> Note: `tasks/plan.md` (last updated 2026-09-26) is **historical** — its assumptions (e.g. the 5-year licence criterion, removed 2026-10-22) and its P0–P2 phase map are superseded by specs/09 §13. Do not follow it for planning; use specs/09 and update `tasks/todo.md` as the live tracker.

## Model lineup (October 2026 — re-check on the [Cursor models page](https://cursor.com/help/models-and-usage/available-models); availability and billing are plan-dependent)

| Model | Use for | Cost |
|---|---|---|
| **Claude Opus 5.5** (high thinking) | Planning, Phase 0, correctness reviews, subagent coordination | API list price |
| **GPT-5.6 Sol** | Correctness-critical implementation (Phase 3, Phase 4) | API list price |
| **Composer 2.5** | Agentic execution loops, CRUD, scaffolding, i18n, tests | Plan-dependent — see [available models](https://cursor.com/help/models-and-usage/available-models) |
| **Grok 4.7** | Long unattended runs, background/cloud agents | Plan-dependent — see [available models](https://cursor.com/help/models-and-usage/available-models) |
| **Auto** | Everything routine | Plan-dependent |

## The core pattern (every phase)

1. **Plan first, execute second.** In Cursor, select a reasoning model (Claude Opus 5.5 by default) and **Plan mode**: "Read specs/09 §13 Phase N and the relevant sections, then produce a plan mapped to the acceptance scenarios. Do not write code yet." Review and save the approved plan.
2. **Execute:** open an Agent-mode session, select the execution model (Composer 2.5 by default, GPT-5.6 Sol where the phase table says so), and hand it the approved plan as the execution prompt.
3. **Every task ends verified, not merely green:** record the **baseline** (`npm test`, `npm run typecheck`, `npx biome check`) before starting; the task is done when there are **no new regressions**, the applicable acceptance tests pass, and **pre-existing failures are explicitly reported** (never silently "fixed" by unrelated edits, and never fixed by weakening a test — tests encode SC scenarios).
4. **Update `tasks/todo.md`** as work lands (it is the live tracker; check items off, add the next phase's items).
5. **Stuck twice = diagnose, then hand off:** after two failed approaches, diagnose the failure and preserve the evidence, then hand the task to an alternate reasoning model if appropriate (e.g. Composer → GPT-5.6 Sol or Opus 5.5). If a design question conflicts with the spec, stop and surface it — do not improvise against specs/09 or `.cursor/rules/drivelinkup.mdc`.

## Phase-by-phase

### Phase 0 — Repository inventory and gap map
- **Model/mode:** Claude Opus 5.5 (high thinking), **Plan mode only** — an instructional gate, not technical enforcement. **No application-code, schema, or production changes**; saving the documentation artifact is the permitted output.
- **Kickoff prompt:** "Read specs/09-scalable-platform-specification.md (esp. §1, §11, §13 Phase 0) and .cursor/rules/drivelinkup.mdc. Produce the repository inventory and gap map: existing vs missing entities, routes, services — and the evidence-gated migration plan for bookingMode → SchoolAuthorization (§1). No new architecture, no code changes."
- **Done when:** the artifact exists at **`docs/v1.2-gap-map.md`** with its companion **`docs/v1.2-migration-bookingMode-to-SchoolAuthorization.md`** (produced 2026-10-23), listing every gap against §11's entity table, every conflict between the spec / `AGENTS.md` invariants / existing rules, plus the migration plan with the §1 rules and SC-14 as a test case. **Review it — including verifying its EXISTING/PARTIAL/MISSING verdicts against the actual code — before any implementation begins**; it gates every later phase. Known correction (2026-10-23 review): the gap map marks the `contact` restriction as MISSING, but it is deployed on `main` (`InstructorBookingModeEnum` includes `contact`; 403 guards in the bookings, offerings-requests, and instructor-availability routes; PRs #27/#28).

### Phase 1 — Authorization and safety
- **Model/mode:** kickoff Plan with Opus 5.5; execution Agent with **Composer 2.5**; review the withdrawal-semantics code (scope-specific, survives refresh, existing bookings keep lifecycle) with Opus 5.5.
- **Build:** `SchoolAuthorization` + scopes, server-side enforcement on every booking/request/availability entry point, complaints workflow, non-destructive migration + migration tests.
- **Done when:** tests cover SC-1, SC-2, SC-3, SC-4, SC-13, SC-14, SC-17 (directory visibility without booking onboarding), and SC-19 (verified organization-binding isolation), with no new regressions against the baseline.

### Phase 2 — Canonical booking services
- **Model/mode:** kickoff Plan with Opus 5.5 or GPT-5.6 Sol; execution Agent with Composer 2.5.
- **Build:** policy service (E0–E4 action matrix), booking state machine with transition rows, payment/commission/concurrency rules, cancellation-policy versioning + snapshots.
- **Done when:** SC-5, SC-6, SC-10, SC-15, SC-16, SC-18 (legacy policies import as draft — migration never invents school approval) covered; state-machine transition table tested.

### Phase 3 — Reliable processing
- **Model/mode:** **GPT-5.6 Sol** for both design and implementation — this is the correctness-critical phase (durable inbox/outbox, idempotency, quarantine).
- **Build:** inbox/outbox per specs/09 §6.4, bounded retries, dead-letter with redacted retention, reconciliation job, quarantine semantics (SC-20 is the tricky one: TTL expiry must never release quarantine).
- **Done when:** SC-11, SC-12, SC-20 covered; the outbox write is provably in the same transaction as the booking-state change.

### Phase 4 — Connectivity API
- **Model/mode:** **GPT-5.6 Sol** for the contract implementation; Composer 2.5 for scaffolding/route boilerplate.
- **Build:** partner auth (HMAC signing per §7.1), DriveLinkUp-hosted endpoints, webhook signing, sandbox/production isolation, rate limits.
- **Done when:** SC-7, SC-9 covered; adapter contract (§7.2) has request/response schemas validated in tests.

### Phase 5 — Certification and admin tooling
- **Model/mode:** **Composer 2.5** — mostly CRUD and admin surfaces.
- **Build:** partner registry, milestone evidence tracking, capability-scoped `prod_enabled`, admin console, school-facing connection UX, partner directory.
- **Done when:** SC-8 covered; capability gating enforced server-side (availability-only certification can never enable booking).

### Acquisition track — supply-side acquisition (specs/09 §13 ACQ; docs/acquisition-strategy.md)
- **Model/mode:** standard pattern — Plan with Opus 5.5, execute with Composer 2.5.
- **Read first:** specs/09 §13 ACQ track and docs/acquisition-strategy.md (the strategy: segments, stages, bounded pilot, and the execution boundary in its §6).
- **Build in priority order:** ACQ-1 (claim funnel, with the category model shared from the start — no B-only claim flow) → ACQ-3 (school-mediated instructor onboarding) → ACQ-2 (lead dashboard) → ACQ-4 (professional-category supply) → ACQ-5 (concierge tooling). Per-capability prerequisites are in specs/09 §13 — the tracks are eligible to run alongside each other, but do not restart or silently expand an in-flight phase, and do not launch concurrent agents against the same files.
- **Hard rules:** no seeding before the register route is verified (synthetic fixtures for development; documented manual prospecting is the alternative); imported candidates private until eligibility checks; claim verification grants no commercial scopes; no independent instructor publication/selling; review-capacity throttle respected (verification ops scale with acquisition); consent firewall and verification gates unchanged. Bounded execution (docs/acquisition-strategy.md §6): no outreach, no bulk publication, no spend, no vendor contact, no production activation without separate explicit authorization — software completion is not supplier-acquisition success.
- **Done when:** SC-21…25 covered and the prerequisite phases' acceptance stays green (no regressions).

### Phase 6 — Pilot and production
- **Model/mode:** **Grok 4.7** for long unattended test runs and background agents; human decisions on vendor/pilot terms ([EXTERNAL]).
- **Build:** milestone 4/5 **test harnesses and tooling** — these may be built before any vendor agrees. Real vendor-environment tests, milestone evidence, and certification remain blocked on a partner. **This workflow does not authorize production changes or unattended deployment.** No vendor invitations are code.

## Standing rules

- Rules files are law: `.cursor/rules/drivelinkup.mdc` (rules 1–23) and `AGENTS.md` invariants apply always; on conflict with older docs, specs/09 wins.
- A separate daily audit (external to Cursor) reviews commits and PRs against the spec — deviations get flagged to the founder, so keep work traceable to SC scenarios.
- Background/cloud agents: use Grok 4.7 (included usage; built for long runs). Explicit subagent models available include `claude-opus-5-thinking-high`, `gpt-5.6-sol-xhigh`, `composer-2.5` — prefer `inherit` unless a subtask needs a specific strength.
- Third-party models (Claude/GPT/Gemini) are plan-dependent and typically bill at API list price — reserve them for Plan-mode thinking and correctness-critical phases; let Composer 2.5 and Auto carry the volume.
