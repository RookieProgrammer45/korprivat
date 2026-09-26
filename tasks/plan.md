# DriveLinkUp technology roadmap

Last updated: 2026-09-26

## Product assumptions (correct if wrong)

1. Marketplace supply = **driving schools + certified instructors**; demand = **learners** (age ≥ 16).
2. Learners pay **0%** DriveLinkUp fee; schools/instructors pay **10%** only after completed service.
3. Private handledare = guidance path only — **not** bookable marketplace supply.
4. Instructors must have held a full driving licence **≥ 5 years**.
5. Sweden-first; Vercel + Neon + Blob; Didit for ID/age verification next.

## Current state

| Area | Status |
|------|--------|
| Public browse / compare / book schools | Live |
| Role-specific signup (learner / school / instructor) | Shipped (needs Neon schema push) |
| Escrow, cancellation, receipts | Implemented + unit/integration coverage |
| Mobile responsive | Partially fixed; still auditing |
| Didit ID / age verification | Skill installed; not wired |
| Test suite | ~216 passing; fix remaining failures before promote |

## Phase map

### P0 — Stabilize (this sprint)

1. Mobile + desktop responsive pass on home, directory, signup, booking, dashboards
2. Make unit tests green (Blob mocks, brand copy, directory filters)
3. `prisma db push` / migrate UserProfile signup fields on Neon
4. Browser audit of critical paths before any promote

### P1 — Trust & verification

1. Wire Didit ID document verification for school + instructor licence uploads
2. Wire Didit biometric age estimation / DOB cross-check for learners
3. Admin review queue UX polish for pending licences

### P2 — Marketplace depth

1. Directory surfaces schools **and** certified instructors distinctly
2. Instructor listing onboarding (availability, price, categories) parity with schools
3. Learner booking flow polish on mobile (filters, comparison, checkout)

### P3 — Growth & ops

1. Observability (error budgets, booking funnel metrics)
2. SEO city hubs / content QA
3. Stripe Connect payout reconciliation reporting
4. Handledare path (if/when product reopens it) kept separate from supply

## Execution order (vertical slices)

1. **Responsive shell** — no horizontal overflow; readable type; usable forms at 390px and ≥1280px
2. **Green tests** — gate deploys on `vitest run` green for unit suite
3. **Schema live** — UserProfile signup fields on Neon
4. **Didit learner age** — replace trust-me DOB with verification where API key exists
5. **Didit instructor/school docs** — authenticity check on credential upload
6. **Directory dual supply** — copy + filters for school vs instructor

## Acceptance gates (every deploy)

- [ ] Unit tests pass
- [ ] Manual mobile + desktop smoke: home, /instructors, /signup (3 paths), login
- [ ] No horizontal scroll at 390×844
- [ ] Signup enforces age 16+ and instructor licence years ≥ 5
- [ ] No secrets in commit
