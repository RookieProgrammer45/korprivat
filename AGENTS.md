# DriveLinkUp — Agent Operating Manual

You are the lead engineer for DriveLinkUp, a Sweden-first marketplace connecting
learners (16+) with certified driving instructors, driving schools, and
handledare (Trafikverket-oriented supervised practice). This file is
authoritative. Read it before every task.

**Decisions:** [ADR-001 Sweden-first](docs/decisions/ADR-001-sweden-first.md) ·
[ADR-002 better-auth](docs/decisions/ADR-002-better-auth.md)

## Invariants (never violate)

1. **Verified DOB is the only age gate for booking.** Authoritative DOB is
   written only by the Didit webhook (or documented verification writer). Never
   treat a signup-form DOB as verified for booking eligibility.
2. **Bookings cannot overlap.** Enforced by a Postgres exclusion constraint on
   the existing `Booking` table (`startsAt`/`endsAt`). Never check overlap in
   application code alone.
3. **Money stays on the Stripe/Polsia payment path.** No custom ledgers. Current
   fee model: **0% learner fee, 10% instructor commission, SEK** — encoded in
   `src/lib/business/booking-fees.ts` and table-tested. Do not invent school
   payout splits until Organizations exist.
4. **Webhooks are idempotent.** Every webhook handler dedupes on a unique key
   before doing any work.
5. **No cross-context DB writes.** Each bounded context owns its tables. Import
   the service, not the model.
6. **Instructors must be verified to appear in search** once instructor
   verification ships (`verificationState = APPROVED` and no expired
   insurance/licence docs).
7. **Handledare enrollment for supervised practice is a legal artefact.** Model
   `HandledareEnrollment` (not parental guardian consent). Never hard-delete;
   mark revoked/expired only.

## Bounded contexts

| Context | Service root | Owns (target / evolving) |
| --- | --- | --- |
| Identity & Auth | `src/lib/identity/` (today: `src/lib/auth*.ts`) | User, Session, Account (better-auth) |
| Verification | `src/lib/verification/` | Learner verification state, Didit, HandledareEnrollment, instructor licence |
| Organizations | `src/lib/orgs/` | Organization, Membership — **not started** |
| Discovery | `src/lib/discovery/` | Instructor search / geo (today: `api/instructors*`) |
| Scheduling | `src/lib/scheduling/` | AvailabilitySlot, Booking |
| Payments | `src/lib/payments/` + `src/lib/business/booking-fees.ts` | Charges, receipts, fee math |
| Trust | `src/lib/trust/` | Review, Dispute, reports |
| Comms | `src/lib/comms/` (today: `src/lib/email/`) | Notification, email |
| Admin | `src/lib/admin/` (today: `admin-guard` + `api/admin/*`) | Review queue, audit |

## Where the deep specs live

- `docs/architecture.md` — system architecture. Read §6 and §7 before
  cross-cutting work.
- `docs/learner-verification-flow.md` — age gate, Didit, handledare enrollment.
- `docs/api-conventions.md` — route naming, error shape, pagination (when present).
- `docs/decisions/` — ADRs.

When a task touches a bounded context, `@`-mention the matching spec. Do not
guess at the data model — read `docs/architecture.md` §6 and the live Prisma
files under `prisma/schema/`.

## Stack

Next.js 16 App Router · TypeScript strict · Prisma · PostgreSQL (Neon) ·
**better-auth** · Stripe via Polsia billing proxy (Connect later as needed) ·
Didit · Resend/email proxy · Vercel · Tailwind + shadcn/ui.

## Routes (do not rename)

| Role | Dashboard |
| --- | --- |
| Student / learner | `/dashboard/student` |
| Instructor | `/dashboard/instructor` |
| Handledare | `/dashboard/handledare` |

Onboarding continues under `/signup` and future `(onboarding)` routes. Do **not**
introduce `/learner/*` as the primary surface.

## Guards

- Edge: `proxy.ts` (CSP + optional `@polsia:slot middleware_chain` contributions).
  **Never** add `middleware.ts` (Next 16 / Polsia reject the old name).
- Pages: `requireDashboardSession` in `src/lib/dashboard-guard.ts`, plus
  `requireSignupPrerequisites` / handledare clickwrap guards.
- APIs: `requireAuth` / admin session checks.

## How to work

1. Name the bounded context before writing code.
2. List files to create/modify across `src/lib/<context>/`, `src/app/`, `prisma/`.
3. State which invariants above apply.
4. If the task isn't covered by a spec or ADR, stop and ask — don't invent.
5. After writing, run `npm run typecheck && npm test` and fix failures.

## Never

- Never trust a client-provided DOB, role, price, or fee split.
- Never call Stripe, Didit, or Twilio from a client component.
- Never write to another context's tables directly.
- Never merge migrations across contexts in one PR.
- Never hard-delete HandledareEnrollment rows.
