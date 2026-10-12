# DriveLinkUp — website reliability repair

**Date:** 12 October 2026

**Repository:** [https://github.com/RookieProgrammer45/korprivat](https://github.com/RookieProgrammer45/korprivat)

**Source baseline:** `84c273bb899eabaeb0373669b1e85631fa9e22ea`

**Review branch:** `fix/webapp-reliability-20261012`

**Production references:** [https://www.drivelinkup.com](https://www.drivelinkup.com) and [https://drivelinkup-web.vercel.app](https://drivelinkup-web.vercel.app)

## Scope and delivery

The user prioritized **fixing the existing web app first**. The exact GitHub source was pulled and the existing Next.js/React/TypeScript/Prisma/Better Auth/Stripe/Didit architecture retained. Five independent source audits covered public discovery, account recovery, booking/payments, dashboards/messaging, and mobile navigation/localization. Confirmed issues were patched and reviewed, including correction of issues found in the final integration review.

**This is a review-branch delivery, not a production deployment.** No source changes were pushed to website `main`; no production deployment was promoted. The separately initialized Expo mobile app is **paused, not built or delivered**.

## Fixed outcomes

### Booking, pricing, checkout and refund integrity

- Selected lesson duration now controls the server-authoritative SEK lesson price. The same frozen booking amounts feed quote, checkout, receipts, cancellation and related payment consumers; later profile-rate changes do not reprice the booking.

- Quote requests identify the selected slot. Invalid/unsupported slots and unavailable providers are rejected; stale quote responses cannot overwrite a newer selection.

- Checkout issuance is serialized by compare-and-set against cancellation, payment and saved-session state. Open sessions are reused; expired sessions receive a new durable claim rather than repeatedly reusing an expired provider idempotency key.

- New durable issuance claims retain the exact original Stripe request parameters and a short, stable claim identifier for provider idempotency. Replays do not change locale, origin or metadata under the same key.

- Cancellation cannot be overwritten by a late `pending` write or paid fulfillment. A captured cancellation is a reconciliation outcome, not a harmless duplicate. Open sessions are expired; payment/refund races use stable keys and preserve terminal cancellation outcomes.

- Authenticated cancellation follow-up can recover an ambiguous Stripe-success/database-persistence failure using the stored parameters, save the real Stripe session reference, expire/reconcile it, and never return a recovered payable URL. Historical opaque claims lacking replay parameters remain explicitly pending for operator review.

- Request-to-book acceptance now transitions to an issuer-admissible state. Failure rollback is constrained to an exact uncharged, session-free, claim-free CAS; winning payments/cancellations and ambiguous issuance references are never erased.

- Refund completion uses the provider's retrieved `succeeded` refund state. Pending/requires-action/failed refunds do not stamp completion or send a false success email; operator dispute resolution also cannot finalize them prematurely.

- Signed/mock webhook and payment-poll fulfillment validate `SEK` currency and the exact frozen minor-unit amount. Failed required reconciliation remains retryable before webhook ledger acknowledgment.

- Receipt API/UI/PDF show frozen SEK consistently. Historical USD fields retain their original meaning; duplicate receipt repair does not rewrite historical monetary snapshots.

- Cancellation fees/refunds derive from the frozen SEK charge, not mutable profile rates. Unpaid cancellations do not fabricate a fee. New fee audit records include exact SEK; legacy rounded USD records remain distinguishable.

- Cancellation UI retains its recorded state after refresh/network failures and provides real follow-up. Authorized signed-in users do not require an unnecessary bearer token.

### Marketplace/provider boundary and discovery

- Verified, non-expired marketplace-provider eligibility is checked consistently at directory, direct profile, availability, quote and booking boundaries. `HANDLEDARE`, missing-account and inactive/pending/rejected/expired providers cannot be booked through a saved direct URL.

- Licence expiry is enforced at request time; correctness no longer waits for the maintenance cron to update status.

- Rating, weekday/weekend, and radius filtering return consistent results. City choices are derived from the final returned result set.

- Invalid numeric directory input produces field-level feedback while server-side validation remains authoritative.

### Account recovery and workflow state

- Validated same-origin `next` destinations survive login → reset request → email/reset → login. External, scheme-relative, and unsafe return targets are rejected.

- Transport promise rejections in sign-in, reset request, and reset forms restore controls and show truthful localized retry messages.

- Verification resume/photo handoffs preserve their sanctioned workflow state without weakening verified-DOB booking eligibility.

- Claimed DOB cannot be changed after verification advances beyond the initial sign-up state; verified DOB remains owned by the verification writer.

### Dashboards, messaging and mobile-web navigation

- Latest-request identity prevents conversation A from overwriting selected conversation B after slow responses. Send callbacks carry the correct conversation identity.

- Message-list, price-quote and payment-poll Retry buttons cause real requests.

- Combined cancellation-tier/booking-mode changes retain a correct Save-enabled dirty state.

- Every reachable learner payment lifecycle state has a visible status label/fallback.

- Empty provider calendars load the server-supplied timezone rather than assuming Stockholm; UTC fallback and daylight-saving handling remain consistent.

- Root document language, 404/route/global failures and contact submission locale track Swedish/English correctly.

- Consent banner rehydrates validated cookie state when local storage is empty/unavailable.

- Footer navigation no longer advertises student-only payment-method routes to non-student roles.

## Verification evidence

All application tests used mocked services. No production credentials or records were used for these checks.

| Check | Final result |
| --- | --- |
| TypeScript `npm run typecheck` | Passed |
| Full unit suite `npm test` | **57 files; 353 tests passed** |
| Full configured mocked integration suite `npm run test:integration` | **11 files; 112 tests passed** |
| Next.js production compilation `npm run build` | Passed with disabled local database and fake provider credentials |
| Changed-source Biome check | Passed: 95 TS/TSX/JSON files; 25 warnings and 3 informational findings, no errors |
| `git diff --check` | Passed |
| Runtime-only dependency audit `npm audit --omit=dev` | Zero reported advisories |
| Full dependency audit | 3 high development-tool advisories remain in Prisma / `@prisma/config` / `deepmerge-ts` |
| Whole-repository lint | Still fails with 171 errors, 62 warnings, 3 infos; baseline had 208 errors, 53 warnings, 3 infos |

The configured integration command already excludes `profile-picture.test.ts`; this repair did not add that exclusion. Full-repository lint debt was not hidden or mass-reformatted outside the repair scope. Dependency changes pin patched Next.js 16.3.8, Vitest 4.1.11 and Vite 6.4.4, with compatible lockfile remediation. The advisory tool recommends a Prisma downgrade for the remaining development-tool issue; no forced ORM downgrade was applied.

## Required deployment prerequisite

Apply the additive migration **`20261012120100_cancellation_fee_exact_sek`** in the approved deployment workflow **before running this version in production**:

```sql
ALTER TABLE "LateCancellationFee" ADD COLUMN "amountSek" INTEGER;
```

The schema declares `amountSek Int?`. New cancellations store exact SEK. Existing records keep `amountSek = NULL` because the original SEK amount cannot safely be reconstructed from rounded historical USD. The migration contains no deletion or historical monetary rewrite.

**The migration was prepared, not executed.** Local Prisma client generation is not a database migration. Migration/deployment should be performed only after approval and staging verification, with existing operational backup/rollback controls.

## Remaining decisions and operational verification

- **School-member availability navigation policy:** the audit found overview/revenue routing to school home while direct personal availability editing remains permitted for an authorized provider. No cross-user bypass was demonstrated. This behavior is unchanged pending a product decision about whether to expose or redirect that surface.

- **Real integrations:** Stripe Checkout/refund webhooks, Didit identity verification, email delivery, and expiry cron configuration were not exercised end-to-end against real providers. Verify on staging/test-provider mode before release.

- **Historical financial records:** no production query or monetary rewrite was performed. An operator must determine whether past bookings/receipts were affected; the audit establishes no affected-user count.

- **Legacy ambiguous claims:** old opaque issuance markers without frozen parameters require operator review; follow-up reports reconciliation pending rather than inventing a completion result.

- **Provider refund failure/action requirements:** surfaced truthfully; an operator/customer may need to complete the provider-required action rather than the application silently treating it as settled.

- **Known development-tool advisories and lint debt:** remain documented above and should be addressed in a separately scoped toolchain/cleanup change.

No finite audit can establish the absence of every conceivable bug. The claims in this handoff are limited to source traces, mocked regression outcomes, local compilation, and the stated review scope.
