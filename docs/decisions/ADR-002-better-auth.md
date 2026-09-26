# ADR-002: Auth stack stays better-auth

## Status
Accepted

## Date
2026-09-26

## Context
Architecture drafts specified Auth.js v5. The running app already uses **better-auth** (Prisma adapter, admin plugin, session cookies) under `src/lib/auth.ts` / `src/lib/auth-config.ts`, with Polsia module wiring and `User` / `Session` / `Account` models in `prisma/schema/auth.prisma`.

## Decision
**Keep better-auth.** Do not migrate to Auth.js.

- Marketplace role lives on `UserProfile.role` (`STUDENT` | `INSTRUCTOR` | `HANDLEDARE`).
- better-auth `User.role` remains the admin-plugin value (`user` | `admin`).
- Route protection for pages uses `requireDashboardSession` / related guards in `src/lib/`; API routes use `requireAuth` / admin checks. Edge entry is `proxy.ts` (Next.js 16), not `middleware.ts`.

## Alternatives Considered

### Migrate to Auth.js v5 to match the draft architecture
- Pros: Aligns with older docs.
- Cons: Large rewrite, breaks Polsia/auth module contracts, high risk for no product gain.
- Rejected: Reconcile docs to code.

## Consequences
- Docs and `AGENTS.md` name better-auth, not Auth.js.
- New verification/booking work extends existing session helpers; no parallel auth system.
