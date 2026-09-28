# Progress

## Database migration baseline (follow-up)

- [ ] The following tables exist in the DB but have no migration
      file: Booking, Instructor, UserProfile, and the rest of the
      marketplace tables.
- [ ] Until a baseline migration lands, use the manual workflow in
      prisma/migrations/README.md.
- [ ] Do NOT run `npx prisma migrate dev` or `npx prisma migrate
      reset` until the baseline is complete.

## Ownership

- [x] Stripped Polsia markers and metadata (commit 7d1373f)
- [x] Replace email proxy with direct Resend (Slice 2)
- [ ] Replace storage proxy with direct Vercel Blob / R2 (Slice 3)
- [ ] Replace Stripe proxy with direct Stripe SDK (Slice 4)
- [ ] Replace AI proxy with direct OpenAI SDK (Slice 5)
- [ ] Classify and clean: polsia-analytics.tsx, layout.tsx
      analytics, instrumentation.ts, CSS polsia-slot comments

## Phase 0 — learner state resolver (soft-gate)

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. STUDENT dashboard entry soft-gates only
`BLOCKED_UNDERAGE` / `SUSPENDED`; incomplete states may browse
`/dashboard/student` with a non-blocking verify banner. `requireActiveLearner()`
exists for booking/checkout but is **not wired** until one real KYC
session confirms the writer. Next slice: wire `requireActiveLearner` on
booking surfaces once one real KYC session completes.

## In progress

- Signup: 4-step wizard (account → email → photo → KYC) for LEARNER; ID
  document Didit Free KYC on `/onboarding/learner/verify`. Email verification
  via better-auth + Polsia email proxy; dashboards require `emailVerified`.
- School registration (slice 1a): `/for-skolor` creates Organization + OWNER
  Membership and lands on `/dashboard/school`.

## School dashboard follow-ups

(Moved into Known issues below — slice 1b.)

## Production findings

- [ ] `drivelinkup.com` apex has a 308 redirect to
      `www.drivelinkup.com`. Verify all webhook destinations point at
      the www host. Didit destination updated 2026-09-26.

## Known issues

- [ ] Nav shows student tabs when a school owner views
      /dashboard/school. Add membership-aware nav in
      site-nav.tsx. Slice 1b or 2.
- [ ] Rate limit + idempotency + health check for
      /api/orgs/register. Slice 1b.
- [ ] Cache school membership in session JWT (slice 1b).
      Currently hits DB on every dashboard load.
- [ ] Booking gate still uses claimed DOB soft-gate. Tighten to
      require ACTIVE once one real KYC session completes in production.
- [ ] Deprecated `UserProfile` columns `ageEstimatedYears` /
      `ageCheckRequestId` / `ageCheckStatus` (facial estimation retired
      2026-09-27). No migration to drop yet.
- [ ] Existing selfie-verified users: none found in Neon at cutover
      (0 `ageEstimatedYears` rows); flag any future estimate-only rows
      for re-verification via ID KYC.
- [ ] zsh .zshrc module_init warning (local machine, not app)
- `POST /api/bookings/…/[id]/payment-link` and `payment-poll` do not
  check learner verification. Revisit when the hard gate lands.
- **`/onboarding/instructor`:** does not exist. Instructor post-signup uses
  `dashboardPathFor('INSTRUCTOR')` → `/dashboard/instructor`. Listing fields
  continue on `/instructors/new` after auth.
