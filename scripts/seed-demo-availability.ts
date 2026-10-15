// Operator backfill: demo AvailabilitySlot rows for existing Instructor listings.
//
// Data problem it fixes: GET /api/instructors/[id]/availability filters
// `bookedAt IS NULL AND startsAt > now()`, so once the seeded slots expire
// (or for listings that never had slots) every school returns { items: [] }
// and nextSlotAt: null. The query is correct — the rows are simply missing.
//
// Safety:
// - READs Instructor ids only. Never creates, updates, or deletes Instructor rows.
// - WRITEs only AvailabilitySlot rows via upsert on (instructorId, startsAt),
//   so re-runs are no-ops for slots that already exist.
// - Past slots and booked slots are never touched.
//
// Usage (SHOW BEFORE RUNNING — do not execute without PM approval):
//   npx tsx scripts/seed-demo-availability.ts --dry-run   # preview only, no writes
//   npx tsx scripts/seed-demo-availability.ts             # write missing slots
//
// Requires DATABASE_URL in the environment (same as `npm run db:seed`).

// biome-ignore lint/style/noRestrictedImports: operator seed script runs standalone with DATABASE_URL (same as db:seed) - direct import is intentional
import { PrismaClient } from '@prisma/client';
import { buildDemoAvailabilitySlots } from '../src/lib/business/marketplace-seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--dry-run');

  const instructors = await prisma.instructor.findMany({
    select: { id: true, name: true },
    orderBy: { id: 'asc' },
  });
  if (instructors.length === 0) {
    process.stdout.write('No instructors found — nothing to do.\n');
    return;
  }

  const ids = instructors.map((row) => row.id);
  const slots = buildDemoAvailabilitySlots(ids);
  process.stdout.write(
    `Found ${instructors.length} listings: ${ids.join(', ')}\n` +
      `Planned ${slots.length} slot rows (${dryRun ? 'DRY RUN — no writes' : 'upsert, existing kept'}).\n`,
  );

  if (dryRun) return;

  let created = 0;
  for (const slot of slots) {
    const result = await prisma.availabilitySlot.upsert({
      where: {
        instructorId_startsAt: {
          instructorId: slot.instructorId,
          startsAt: slot.startsAt,
        },
      },
      create: slot,
      update: {},
    });
    // `upsert` returns the row either way; count rows whose createdAt is
    // within this run as newly created (best-effort reporting only).
    if (Date.now() - result.createdAt.getTime() < 60_000) created += 1;
  }
  process.stdout.write(`Done. ${created} new slot rows (rest already existed).\n`);
}

main()
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
