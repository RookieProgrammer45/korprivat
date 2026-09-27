# Progress

## Phase 0 — learner state resolver (soft-gate)

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. STUDENT dashboard entry soft-gates only
`BLOCKED_UNDERAGE` / `SUSPENDED`; incomplete states may browse
`/dashboard/student` with a non-blocking verify banner. `requireActiveLearner()`
exists for booking/checkout but is **not wired** until one real KYC
session confirms the writer. Next slice: wire `requireActiveLearner` on
booking surfaces once one real KYC session completes.

## In progress

- Signup: 3-step wizard (account → photo → KYC) for LEARNER; ID document
  Didit Free KYC on `/onboarding/learner/verify`.

## Production findings

- [ ] `drivelinkup.com` apex has a 308 redirect to
      `www.drivelinkup.com`. Verify all webhook destinations point at
      the www host. Didit destination updated 2026-09-26.

## Known issues

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
