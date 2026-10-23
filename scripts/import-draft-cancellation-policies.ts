/**
 * Import legacy cancellation tiers as draft policies. Never approves them
 * and never rewrites Booking.cancellationPolicyTier.
 *
 * Usage: npx tsx scripts/import-draft-cancellation-policies.ts
 */
import { prisma } from '../src/lib/db';
import {
  draftPolicyFromLegacyTier,
  type LegacyCancellationTier,
} from '../src/lib/scheduling/booking-policy';

function isTier(value: string | null): value is LegacyCancellationTier {
  return value === 'flexible' || value === 'moderate' || value === 'strict';
}

async function main() {
  const listings = await prisma.instructor.findMany({
    select: { id: true, cancellationPolicyTier: true },
  });
  let drafted = 0;
  for (const listing of listings) {
    if (!isTier(listing.cancellationPolicyTier)) continue;
    const draft = draftPolicyFromLegacyTier(listing.cancellationPolicyTier);
    const existing = await prisma.cancellationPolicy.findFirst({
      where: { listingId: listing.id, source: 'legacy_tier' },
      select: { id: true },
    });
    if (existing) continue;
    const versionRow = await prisma.cancellationPolicy.aggregate({
      where: { listingId: listing.id },
      _max: { version: true },
    });
    await prisma.cancellationPolicy.create({
      data: {
        listingId: listing.id,
        version: (versionRow._max.version ?? 0) + 1,
        deadlineType: draft.deadlineType,
        deadlineValue: { tier: listing.cancellationPolicyTier },
        timezone: 'Europe/Stockholm',
        businessCalendar: { weekdays: [1, 2, 3, 4, 5] },
        source: draft.source,
        state: draft.state,
        approvedAt: draft.approvedAt,
        activeListingKey: null,
      },
    });
    drafted += 1;
  }
  const active = await prisma.cancellationPolicy.count({ where: { state: 'active' } });
  if (active > 0 && process.env.CANCELLATION_IMPORT_STRICT === '1') {
    throw new Error(`Import must not leave active policies; found ${active}`);
  }
  process.stdout.write(`Draft policies created: ${drafted}. Active policies untouched.\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : 'import failed'}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
