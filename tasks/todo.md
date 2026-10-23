# DriveLinkUp — active tasks

## Spec v1.2 — Phase 2 (branch feat/phase-2-booking-services)

Plan: docs/v1.2-phase-2-plan.md. `CANCELLATION_POLICY_ENFORCE` defaults off. PR: https://github.com/RookieProgrammer45/korprivat/pull/30 (base: Phase 1). Do not start Phase 3 until PR #30 and Phase 1 PR #29 are merged.

- [x] Policy service E0–E4 with action-specific checks
- [x] BookingStateTransition log; do not replace paymentStatus
- [x] CancellationPolicy versions; legacy tiers import as draft; CANCELLATION_POLICY_ENFORCE defaults off
- [x] Tests: SC-5, SC-6, SC-10, SC-15, SC-16, SC-18
- [x] Route tests: slot conflict, directory policy hide, late capture, manual accept, checkout refusal

## Spec v1.2 — Phase 1 (branch phase-1-school-authorization)

Plan: docs/v1.2-phase-1-plan.md. Flag `SCHOOL_AUTHZ_ENFORCEMENT` defaults off. Withdrawals apply while off.

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
