# DriveLinkUp — Agent Operating Manual

You are the lead engineer for DriveLinkUp, a Sweden-first marketplace connecting
learners (16+) with certified driving instructors, driving schools, and
handledare (Trafikverket-oriented supervised practice). This file is
authoritative. Read it before every task.

**Decisions:** [ADR-001 Sweden-first](docs/decisions/ADR-001-sweden-first.md) ·
[ADR-002 better-auth](docs/decisions/ADR-002-better-auth.md) ·
[ADR-003 canonical webhook host](docs/decisions/ADR-003-canonical-webhook-host.md)

## Invariants (never violate)

1. **Verified DOB is the only age gate for booking.** Authoritative DOB is
   written only by the Didit webhook (or documented verification writer). Never
   treat a signup-form DOB as verified for booking eligibility.
2. **Bookings cannot overlap.** Enforced by a Postgres exclusion constraint on
   the existing `Booking` table (`startsAt`/`endsAt`). Never check overlap in
   application code alone.
3. **Money stays on the Stripe payment path.** No custom ledgers. Current
   fee model: **0% learner fee, 10% instructor commission, SEK** — encoded in
   `src/lib/business/booking-fees.ts` and table-tested. School-affiliated
   bookings are **8%** ([ADR-004](docs/decisions/ADR-004-school-commission.md))
   once a booking records `organizationId` (Phase 5 slice 6). Until then every
   booking uses 10%. DriveLinkUp does not mediate school-to-instructor payouts.
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
| Organizations | `src/lib/orgs/` | Organization, Membership — schema only; services stubbed |
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

  **Never** add `middleware.ts` (Next 16 / Polsia reject the old name).
- Pages: `requireDashboardSession` in `src/lib/dashboard-guard.ts`, plus
  `requireSignupPrerequisites` / handledare clickwrap guards.
- APIs: `requireAuth` / admin session checks.

## Required env vars (Didit)

| Var | Source |
| --- | --- |
| `DIDIT_API_KEY` | Didit console → API Keys |
| `DIDIT_WEBHOOK_SECRET` | Didit console → Webhooks → destination `secret_shared_key` (shown once) |
| `DIDIT_WORKFLOW_ID` | Didit console → Workflows → UUID |

Rules:

- Never hardcode these in source.
- Never pipe them to a CLI via `printf` — interactive prompts only
  (`vercel env add DIDIT_WORKFLOW_ID preview`, etc.).
- Rotate immediately if a value is ever pasted into a chat or log.

## Canonical webhook host

All external services that POST to this app MUST target
`https://www.drivelinkup.com` — not the apex `drivelinkup.com`, which
308-redirects to www. Some HTTP clients drop the request body on 308,
which breaks webhook signature verification and silently loses events.

Affected: Didit webhook destination, Stripe webhook endpoint (when
Connect ships), any future inbound webhook.

## Local env hygiene

Before running `npm run dev`, run `npm run dev:check`. If it reports
shell/.env.local conflicts, unset the offending var in the shell:

  unset DIDIT_WORKFLOW_ID

Then restart. Next.js will not override an existing shell env var
with `.env.local`, so an empty shell export silently wins and the
app sees unset. This has bitten us twice (`BETTER_AUTH_URL`,
`DIDIT_WORKFLOW_ID`).

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
