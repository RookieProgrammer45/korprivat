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
- [x] Storage via direct Vercel Blob (no scaffold proxy)
- [x] Stripe via direct SDK + Connect (no scaffold proxy)
- [ ] OpenAI SDK only if/when AI features ship (no proxy)
- [ ] Classify and clean remaining scaffold residue:
      polsia-analytics.tsx, layout analytics, instrumentation.ts,
      CSS polsia-slot comments, `/example` routes

## Deferred

- [ ] Dashboard mode switcher for dual-role users (OWNER/STAFF +
      INSTRUCTOR). No users match this today. Build when the first
      dual-role user appears, or when a school owner also lists
      themselves as an instructor.

## Phase 0 — learner state resolver

Pure `resolveLearnerState` / `stateToRoute` live under `src/lib/verification/`
with table-driven unit tests. Booking + checkout require ACTIVE learner
verification (`resolveLearnerBookingGate`). STUDENT dashboard still soft-gates
browse for incomplete states with a verify banner.

## In progress

- Signup: 4-step wizard (account → email → photo → KYC) for LEARNER; ID
  document Didit Free KYC on `/onboarding/learner/verify`. Email verification
  via better-auth + Resend; dashboards require `emailVerified`.
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
- [x] Preview Neon branch created (`preview`); wire Vercel Preview
      `DATABASE_URL` — see docs/neon-env-isolation.md (2026-10-03).
- [x] Stripe webhook handlers + StripeWebhookEvent ledger:
      charge.dispute.created, charge.refunded, transfer.failed,
      checkout.session.expired, account.application.deauthorized.
- [x] Reconciliation cron `/api/cron/reconcile-escrow` (nightly).
- [x] Pending-payouts strip uses payoutAmountSek (net).
- [x] Revenue dashboard pending-balance card (held / pending / failed).
- [x] Fee snapshot required at payout — no live hourlyRateSek fallback;
      payoutAmountSek stamped at booking create.
- [x] Partial dispute enabled (ADR-005) — reduce payout by refundSek.
- [ ] actionToken on /complete grants instructor privilege. Review
      in a security pass: should complete require session
      Instructor.userId even when the token matches?
- [x] Cron uses timingSafeEqual for CRON_SECRET.
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
- [x] School membership home cached 60s in resolveDashboardHome (slice 1b).
- [x] Booking + checkout gate require ACTIVE learner verification.
- [ ] Deprecated `UserProfile` columns `ageEstimatedYears` /
      `ageCheckRequestId` / `ageCheckStatus` (facial estimation retired
      2026-09-27). No migration to drop yet.
- [ ] Existing selfie-verified users: none found in Neon at cutover
      (0 `ageEstimatedYears` rows); flag any future estimate-only rows
      for re-verification via ID KYC.
- [ ] zsh .zshrc module_init warning (local machine, not app)
- [x] Checkout enforces ACTIVE learner gate (payment-link retired onto checkout).
- [x] HandledareEnrollment model + invite/approve + admin MANUAL_REVIEW queue.
- [x] Instructor search requires VERIFIED licence (AGENTS invariant 6).
- [x] InstructorLicense.expiresAt + EXPIRED status; expire-docs cron.
- [x] Booking overlap EXCLUDE constraint (startsAt/endsAt + btree_gist).
- [x] CI workflow (.github/workflows/ci.yml) + npm run test:integration.
- [x] Admin escrow ops UI + school 8% commission copy (ADR-004).
- [x] Trust partial disputes (ADR-005) + observability reportError seam.
- [x] Prisma baseline procedure documented (docs/prisma-baseline.md).
- [x] Vercel Preview `DATABASE_URL` (+ Postgres siblings) pointed at Neon
      `preview` branch — see docs/neon-env-isolation.md (2026-10-03).
- **`/onboarding/instructor`:** does not exist. Instructor post-signup uses
  `dashboardPathFor('INSTRUCTOR')` → `/dashboard/instructor`. Listing fields
  continue on `/instructors/new` after auth.
