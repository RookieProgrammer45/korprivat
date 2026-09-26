# Progress

## Phase 0 — learner state resolver (soft-gate)

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. STUDENT dashboard entry soft-gates only
`BLOCKED_UNDERAGE` / `SUSPENDED`; incomplete states may browse
`/dashboard/student` with a non-blocking verify banner. `requireActiveLearner()`
exists for booking/checkout but is **not wired** until the Didit webhook writes
`dateOfBirthVerified`. Next slice: Didit webhook + wire `requireActiveLearner`
on booking surfaces.

## Known issues

- **Anonymous booking:** `POST /api/bookings` still allows guest sessions
  (`getSessionUser` optional). Auth wall + learner role at book time is a
  separate slice — do not confuse with hero CTA wiring.
- **`/onboarding/instructor`:** does not exist. Instructor post-signup uses
  `dashboardPathFor('INSTRUCTOR')` → `/dashboard/instructor`. Listing fields
  continue on `/instructors/new` after auth.
