# Neon environment isolation

Preview and local development must **not** share the production Neon database.

## Branches (project `neon-purple-school` / `tiny-voice-14151062`)

| Branch | Purpose | Endpoint host (pooled) | Vercel env |
| --- | --- | --- | --- |
| `main` | Production | (production host) | Production `DATABASE_URL` only |
| `preview` (`br-sweet-hall-b7yaz6un`) | Vercel Preview + staging | `ep-dawn-smoke-b7btfhhc-pooler.c-13.us-east-1.aws.neon.tech` | Preview `DATABASE_URL` only |

Created 2026-10-03: branch `preview` forked from `main`. Migrations for
StripeWebhookEvent, HandledareEnrollment, booking overlap, and licence expiry
were applied on `preview`.

## Vercel Preview isolation (done 2026-10-03)

Preview was unlinked from the shared Neon-integration `DATABASE_URL` (and
sibling Postgres URLs) and re-pointed at branch `preview`
(`ep-dawn-smoke-b7btfhhc-pooler…`). Production/Development keep the prior
shared values until Development is split the same way.

After changing env vars, redeploy Preview so new builds pick up the URI.
Never run `prisma migrate reset` against production.

## Local

Prefer a dedicated Neon branch or Docker Postgres. If `.env.local` still points
at production, stop and switch before any migrate/seed. See also
`docs/prisma-baseline.md`.
