# Prisma baseline plan (marketplace tables)

Many marketplace tables were created via `db push` before a clean migration
history existed (`prisma/migrations/README.md`). New work ships as normal
migrations (StripeWebhookEvent, HandledareEnrollment, booking overlap).

## Baseline procedure (separate PR — do not bundle with features)

1. `prisma migrate diff` from empty → current schema → `baseline.sql`.
2. On production: mark baseline as applied (`prisma migrate resolve --applied`)
   only after verifying tables already match.
3. Never `migrate reset` on Neon production.

Until baseline lands, continue appending one migration per bounded context.
