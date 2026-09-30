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

## Weekend test plan (Stripe test mode)

Run in Stripe test mode with sk_test_ keys before any live
traffic. Each test must pass end-to-end — not mocked.

1. Instructor Connect onboarding
   - IBAN SE35 5000 0000 0549 1000 0003
   - Verify chargesEnabled + payoutsEnabled flip true
   - Double-click: no duplicate Express account

2. Buyer happy path
   - Book + pay 500 SEK with 4242 4242 4242 4242
   - Webhook fires, paymentStatus = held_escrow

3. Deliver → confirm → transfer
   - Instructor delivers → awaiting_buyer_confirmation
   - autoReleaseAt set ~48h
   - Buyer confirms → release_ready → transfer → released
   - PayoutRecord written, amount = 90% or 92%

4. Auto-release cron
   - Set autoReleaseAt past via SQL
   - POST /api/cron/auto-release with Bearer CRON_SECRET
   - Verify transfer

5. Dispute → admin release
   - Buyer disputes → disputed
   - Admin resolves with outcome=release → transfer
   - Verify partial returns 501

6. Race: confirm + cron concurrent
   - Fire both simultaneously → exactly one transfer

7. Admin retry gates
   - held_escrow → 409
   - awaiting_buyer_confirmation → 409
   - payout_failed → 200 + transfer

8. Cancel + refund
   - Pay → cancel → Stripe refund → refunded

Do not accept live payments until all 8 pass.

## Known issues

- [x] Escrow: either party could mark complete and fire payout with no
      proof of delivery — fixed with deliver → buyer confirm / 48h
      auto-release / dispute-escrow (2026-09-30).
- [ ] Preview + development share production Neon DB. Create
      separate Neon branches; set DATABASE_URL per environment.
- [ ] Missing webhook handlers: charge.dispute.created,
      charge.refunded, transfer.failed, checkout.session.expired,
      account.application.deauthorized.
- [ ] Reconciliation cron: nightly scan for held_escrow bookings
      older than 7 days. Alert if webhook never landed.
- [ ] Pending-payouts strip uses grossChargedSek. Change to
      instructorPayoutSek (net).
- [ ] Revenue dashboard has no view of held_escrow /
      payout_pending / payout_failed. Add pending-balance card.
- [ ] Fee snapshot fallback can charge one rate and payout another
      if instructor rate changes mid-flight. Remove fallback;
      require snapshot.
- [ ] Partial dispute resolution returns 501. Design the payout
      math before enabling. Needs a decision: reduce payout by
      refunded SEK, or split the booking into two ledger entries.
- [ ] actionToken on /complete grants instructor privilege. Review
      in a security pass: should complete require session
      Instructor.userId even when the token matches?
- [ ] Cron uses plain === for CRON_SECRET. Switch to
      timingSafeEqual.
- [ ] Cron batch cap is 50/hour. If held bookings exceed that,
      increase or shard.
- [ ] Dispute dialog does not reset reason/details on dismiss.
- [ ] Dev overlay shows 2 persistent issues: Prisma
      `Unique constraint failed on the fields: (slug)` when creating
      Organization (duplicate slug race in createOrganization).
      Investigate in a cleanup / slice 1b hardening pass.
- [x] Nav shows student tabs when a school owner views
      /dashboard/school — fixed with membership-aware dashboard nav.
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
