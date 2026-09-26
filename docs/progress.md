# Progress

## Phase 0 — learner state resolver (soft-gate)

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. STUDENT dashboard entry soft-gates only
`BLOCKED_UNDERAGE` / `SUSPENDED`; incomplete states may browse
`/dashboard/student` with a non-blocking verify banner. `requireActiveLearner()`
exists for booking/checkout but is **not wired** until the Didit webhook writes
`dateOfBirthVerified`. Next slice: Didit webhook + wire `requireActiveLearner`
on booking surfaces.

## In progress

- Booking soft-gate on claimed DOB. Hard gate (ACTIVE-only) pending
  Didit webhook.

## Known issues

- `requireActiveLearner` exists but is unwired and always sees
  `verifiedDob: null`. Do not import it until the Didit writer ships.
- `POST /api/bookings/…/[id]/payment-link` and `payment-poll` do not
  check learner verification. Revisit when the Didit writer lands.
- **`/onboarding/instructor`:** does not exist. Instructor post-signup uses
  `dashboardPathFor('INSTRUCTOR')` → `/dashboard/instructor`. Listing fields
  continue on `/instructors/new` after auth.
