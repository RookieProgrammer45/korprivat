# DriveLinkUp — active tasks

## Spec v1.2 — Phase 5 completeness (PR #40, not merged)

Plan: docs/v1.2-phase-5-alerting-plan.md. Open: https://github.com/RookieProgrammer45/korprivat/pull/40. Runbook: docs/v1.2-cutover-runbook.md. `OPS_ALERTING` defaults off.

- [x] Alerting surfaces for every §12 leading metric
- [x] Thresholds on inbox depth, dead-letter rate, quarantine age, and reconciliation drift stay unmeasured until configured
- [x] Cutover runbook recorded; no flag is turned on
- [x] Tests: SC-8 unchanged

## Spec v1.2 — ACQ-5 (merged #39)

Plan: docs/v1.2-acq-5-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/39. `CONCIERGE_ONBOARDING` defaults off.

- [x] Draft store preserves provenance and stays unpublished
- [x] School approval is required to publish; admin cannot manufacture it
- [x] Approval and publication grant no policy, verification, or scopes
- [x] Tests: SC-25

## Spec v1.2 — ACQ-4 (merged #38)

Plan: docs/v1.2-acq-4-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/38. `CATEGORY_OFFERINGS` defaults off.

- [x] Teaching permission matches legal entity, location, and category
- [x] B-only permission refuses A/C/D publication
- [x] Approved policy version is snapshotted; a draft is refused
- [x] Tests: SC-22

## Spec v1.2 — ACQ-2 (merged #37)

Plan: docs/v1.2-acq-2-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/37. `LEAD_DASHBOARD` defaults off.

- [x] Zero-scope representative sees historical inquiry count and no booking surface
- [x] New inquiries stay off without inquiry_collection
- [x] Lead conversion creates neither a booking nor a scope
- [x] Tests: SC-24

## Spec v1.2 — ACQ-3 (merged #36)

Plan: docs/v1.2-acq-3-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/36. `SCHOOL_MEDIATED_INSTRUCTORS` defaults off.

- [x] School invitation and verified affiliation grant no scopes
- [x] Flag on: independent publish, sale, and undelegated diary are refused
- [x] Instructor role alone cannot grant scopes; a verified representative still can
- [x] Tests: SC-23

## Spec v1.2 — ACQ-1 (merged #35)

Plan: docs/v1.2-acq-1-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/35. `CLAIM_FUNNEL` defaults off.

- [x] Private prospects; public only after eligibility and data-quality pass, with no claim required
- [x] Synthetic fixtures only; register collection refused
- [x] Claim review never grants commercial scopes
- [x] Tests: SC-21

## Spec v1.2 — Phase 6 (merged #34)

Plan: docs/v1.2-phase-6-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/34. Local harness only. Do not treat a passing run as milestone 5 evidence.

- [x] Five failure checks against an in-process double
- [x] Harness evidence refused; no certification write
- [x] Script exits 0 only when the local pass still cannot enable production

## Spec v1.2 — Phase 5 (merged #33)

Plan: docs/v1.2-phase-5-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/33. `CERTIFICATION_ENFORCEMENT` defaults off.

- [x] Partner and certification records with per-capability prodEnabled
- [x] Server gate: availability-only certification cannot enable transactional booking
- [x] Admin partner list and school connection status
- [x] Tests: SC-8

## Spec v1.2 — Phase 4 (merged #32)

Plan: docs/v1.2-phase-4-plan.md. Merged: https://github.com/RookieProgrammer45/korprivat/pull/32. `CONNECTIVITY_API` defaults off.

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
