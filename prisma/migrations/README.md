# Migration history

This folder is the source of truth for `_prisma_migrations`.
Prisma config points at `prisma/migrations` (see prisma.config.ts)
because the schema lives in `prisma/schema/`.

## Current state (2026-09-27)

`_prisma_migrations` records 7 migrations:
- 20260602000000_init_waitlist
- 20260603000000_init_better_auth
- 20260608000000_init_contact
- 20260612000000_add_better_auth_admin
- 20260926163300_add_didit_verification_writer
- 20260926172000_add_didit_webhook_event_id
- 20260927223030_add_organization_and_membership

## Known drift

The following tables exist in the live database but were created
outside the migration system:
- Booking, AvailabilitySlot, Instructor (marketplace)
- UserProfile, InstructorLicense, PhotoVerification
- ClickwrapAcceptance, ConsentEvent
- Review, Dispute, LateCancellationFee, BookingReceipt
- Conversation, Message, MessageReport
- SavedPaymentMethod, RebookingCache
- CleanupRun, ContactMessage, WaitlistProfile

A baseline migration is planned to capture these. Until then,
`npx prisma migrate dev` will detect drift and offer to reset the
database. **Do not accept the reset.**

## Working workflow until the baseline lands

When adding a new Prisma model or field:

1. Edit prisma/schema/*.prisma
2. Generate the SQL manually:
     npx prisma migrate diff \
       --from-schema-datamodel prisma/schema \
       --to-schema-datamodel prisma/schema \
       --script
   (or write the SQL by hand for small additive changes)
3. Create the migration folder:
     prisma/migrations/<timestamp>_<name>/migration.sql
4. Apply it directly:
     npx prisma db execute --file prisma/migrations/<...>/migration.sql
5. Mark it applied:
     npx prisma migrate resolve --applied <timestamp>_<name>
6. Regenerate the client:
     npx prisma generate

Do NOT run:
  - npx prisma migrate dev
  - npx prisma migrate reset

Both will try to reconcile drift by recreating tables.

## Follow-up

A baseline migration (squashing current state into a single
migration and re-marking everything applied) is planned. See
docs/progress.md for the tracking entry.
