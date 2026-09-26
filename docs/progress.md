# Progress

## Phase 0 — learner state resolver (soft-gate)

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. STUDENT dashboard entry soft-gates only
`BLOCKED_UNDERAGE` / `SUSPENDED`; incomplete states may browse
`/dashboard/student` with a non-blocking verify banner. `requireActiveLearner()`
exists for booking/checkout but is **not wired** until the Didit webhook writes
`dateOfBirthVerified`. Next slice: Didit webhook + wire `requireActiveLearner`
on booking surfaces.
