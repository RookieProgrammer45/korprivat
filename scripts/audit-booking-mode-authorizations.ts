/**
 * Idempotent bookingMode audit. Writes non-granting notes only.
 * Never inserts SchoolAuthorizationEvent rows.
 *
 * Usage: npx tsx scripts/audit-booking-mode-authorizations.ts
 */
import { prisma } from '../src/lib/db';
import { planBookingModeMigration } from '../src/lib/orgs/school-authorization-policy';

async function main() {
  const rows = await prisma.instructor.findMany({
    select: { id: true, name: true, bookingMode: true },
  });
  const plan = planBookingModeMigration(rows);
  console.log(JSON.stringify({ counts: plan.counts, grantsCreated: plan.grantsCreated }));
  if (plan.counts.contact !== 1) {
    console.warn(
      `Expected exactly one contact listing in production (Sjöbo Trafikskola). Found ${plan.counts.contact}.`,
    );
  }
  for (const note of plan.notes) {
    await prisma.bookingModeAuditNote.upsert({
      where: { listingId: note.listingId },
      create: {
        listingId: note.listingId,
        bookingMode: note.bookingMode,
        note: note.note,
      },
      update: { bookingMode: note.bookingMode, note: note.note },
    });
  }
  const grants = await prisma.schoolAuthorizationEvent.count({ where: { kind: 'grant' } });
  if (grants !== 0 && process.env.SCHOOL_AUTHZ_AUDIT_STRICT === '1') {
    throw new Error(`Refusing to finish: ${grants} grant events already exist`);
  }
  console.log(`Audit notes upserted: ${plan.notes.length}. Grant events left untouched.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
