# DriveLinkUp — Cursor Implementation Pack

Buildable product specifications derived from the Product Development Plan v5 (October 2026), the Connectivity Partner Program Design (v0.1), and the verified live-repo state. Nordic-first marketplace for driving schools and driving instructors: drivelinkup.com. The MVP is live; this pack specifies the scalable-platform iteration (connectivity-partner model, per-scope school authorization, capability-scoped certification, audit-defect fixes, verification workflows, connector framework).

## How to use this pack in Cursor

1. **Copy the contents of this pack's folders into your repository root, merging directories** — `specs/` merges into your repo's `specs/`, and `.cursor/rules/drivelinkup.mdc` goes into your repo's `.cursor/rules/` (create it if absent). Do not copy the enclosing `drivelinkup-cursor-spec/` folder itself — that would leave the rules' `specs/...` references pointing at the wrong location.
2. The `.mdc` rule is always-apply and encodes the project's non-negotiables.
3. **Read `specs/09-scalable-platform-specification.md` first — it is the implementation authority.** It consolidates the platform design (connectivity-partner model, authorization scopes, booking engine, reliability architecture, build phases) and reproduces the essential contracts, including Appendices A–B (verification release scenarios, student/school API contracts). Specs 00–08 remain the **detail-of-record**: the detailed test series (BK, VF, UX, CN, API), deeper data-model and workflow detail, and provenance.
4. **Where `specs/09` and specs 00–08 conflict, `specs/09` wins.** Its own §16 maps every earlier requirement to a section inside it.

## Read order

| Order | File | What it gives you |
|---|---|---|
| 1 | `specs/09-scalable-platform-specification.md` | **The implementation authority** — consolidated platform spec: Booking.com-style connectivity model, authorization scopes, booking engine, reliability/quarantine, capability-scoped certification, Cursor build phases, SC-1…20 acceptance, Appendices A–B |
| 2 | `specs/00-product-overview.md` | Product, actors, evidence standards, the three statement kinds |
| 3 | `specs/01-architecture.md` | Stack-agnostic architecture + the repository-discovery gate (first task) |
| 4 | `specs/02-data-model.md` | Proposed logical schema — tables, columns, constraints, invariants |
| 5 | `specs/03-booking-engine.md` | Booking model, capability flags, states, concurrency, reconciliation |
| 6 | `specs/04-verification-module.md` | The verification workflows — the core differentiator |
| 7 | `specs/05-connectors.md` | Connector framework, milestone chain, event handling, failure tests, calendar tier |
| 8 | `specs/06-ux-journeys.md` | User journeys and screen requirements |
| 9 | `specs/07-delivery-plan.md` | Build order, acceptance criteria, bounded Cursor prompts |
| 10 | `specs/08-api-contracts.md` | Proposed application API contracts |
| 11 | `traceability.md` | Every plan requirement → spec location → acceptance → dependency |

## First bounded implementation task

**Gate 0 — Repository discovery** (see `specs/09-scalable-platform-specification.md` §13 Phase 0): before any framework-specific work or migrations, inventory the existing repository against the spec — existing vs missing entities, routes, and services — and produce the evidence-gated migration plan for `bookingMode` → `SchoolAuthorization`. **The existing stack is verified, not hypothetical** (Next.js App Router + TypeScript + Prisma + PostgreSQL/Neon on Vercel, next-intl, better-auth, Stripe Connect): preserve it; Gate 0 maps the gaps, it does not choose a stack. `specs/01-architecture.md` and `specs/07-delivery-plan.md` remain supporting reference for Gate 0 and the older phased plan — where they conflict with `specs/09` §13 (the current build sequence), `specs/09` wins.

## What is blocked by external access (do not fake it)

- **Vendor connectors (STR Optima Smart, LGD/TC, Trafikskola Online, TABS AS Norway, DK/FI vendors):** outreach sent October 22, 2026; no reply implies no access. All vendor connectors are dependencies, not capabilities. Build behind capability flags with mock adapters only.
- **Register APIs (Bolagsverket paid tier, Brreg, CVR, PRH/YTJ, Skatturinn, Companies House, Traficom):** officially documented, production access untested. Build the workflow + evidence model; adapters activate per-market only when access is obtained.
- **Denmark/Finland permit lookups:** routes documented but current-status disclosure unconfirmed (authority inquiries drafted, unsent). Danish/Finnish launches are gated on this.
- **Payment provider:** the live app runs Stripe Connect [OBSERVED-MVP]; what remains unresolved is the payment-provider *decision* for the scaled platform and the `payment_collection` capability terms (liability, SLAs, DPAs). Commission/refund/earnings rules are specified provider-independent.

## Statement kinds (used throughout every spec)

- **[OBSERVED-MVP]** — behavior observed in the live MVP audit (Oct 22, 2026). Existing baseline.
- **[PROPOSED]** — a product/engineering decision this pack makes. Buildable as specified.
- **[EXTERNAL]** — external fact or unresolved dependency, with source. Not a build instruction; a constraint or gate.
