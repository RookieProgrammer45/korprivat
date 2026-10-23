# DriveLinkUp — active tasks

## Spec v1.2 — Phase 4 (branch feat/phase-4-connectivity)

Plan: docs/v1.2-phase-4-plan.md. `CONNECTIVITY_API` defaults off. PR: https://github.com/RookieProgrammer45/korprivat/pull/32. Do not start Phase 5 until this pull request is merged.

- [x] HMAC partner auth, sandbox/production isolation, rate limits, idempotency namespaces
- [x] DriveLinkUp-hosted `/v1/connections` routes; content stays unpublished
- [x] Adapter request/response schemas and mock hold with no partial reservation
- [x] SC-7 mock evidence cannot enable production; SC-9 cross-connection is 403

## Spec v1.2 — Phase 3 (merged #31)

Plan: docs/v1.2-phase-3-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/31. `RELIABLE_PROCESSING` defaults off.

- [x] Inbox dedup, stale rejection, and authoritative retrieval when order is missing
- [x] Outbox write in the same transaction as booking create when the flag is on
- [x] Dead-letter with redacted payload and an ops task
- [x] Quarantine survives TTL expiry and retry exhaustion
- [x] Tests: SC-11, SC-12, SC-20

## Spec v1.2 — Phase 2 (merged #30)

Plan: docs/v1.2-phase-2-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/30. `CANCELLATION_POLICY_ENFORCE` defaults off.

- [x] Policy service E0–E4 with action-specific checks
- [x] BookingStateTransition log; do not replace paymentStatus
- [x] CancellationPolicy versions; legacy tiers import as draft; CANCELLATION_POLICY_ENFORCE defaults off
- [x] Tests: SC-5, SC-6, SC-10, SC-15, SC-16, SC-18
- [x] Route tests: slot conflict, directory policy hide, late capture, manual accept, checkout refusal

## Spec v1.2 — Phase 1 (merged #29)

Plan: docs/v1.2-phase-1-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/29. `SCHOOL_AUTHZ_ENFORCEMENT` defaults off. Withdrawals apply while off.

- [x] Append-only SchoolAuthorizationEvent + representative authority + ListingOrgBinding + complaints
- [x] Server gates on booking create, accept, availability read/publish, offering inquiry, directory times
- [x] Operator complaint page and verified-representative grant/binding routes
- [x] Idempotent bookingMode audit script (zero grants; contact stays restricted)
- [x] Tests: SC-1, SC-2, SC-3, SC-4, SC-13, SC-14, SC-17, SC-19, both flag states, availability route

## Now (P0)

- [x] Install agent-skills pack + routing rule
- [x] Split signup: learner / school / instructor + age/licence rules
- [x] Fix failing unit tests (llms, instructors list, photo Blob mock)
- [x] Responsive audit: home, directory, signup (ongoing polish)
- [x] Neon: apply UserProfile signup fields (`prisma/manual/2026-09-26-user-profile-signup.sql`)
- [x] Didit age-check API + signup UI (activates when `DIDIT_API_KEY` is set)
- [ ] Add `DIDIT_API_KEY` on Vercel + smoke learner selfie path

## Next (P1)

- [ ] Didit ID document verification for school/instructor credentials
- [ ] Browser smoke before promote
