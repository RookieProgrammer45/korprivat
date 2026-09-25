// Operator seed script. Run on demand with `npm run db:seed`.
//
// Same idempotent marketplace seed as server boot (`src/lib/seed.ts`).
import { PrismaClient } from '@prisma/client';
import { seedMarketplace } from './marketplace-seed';

const prisma = new PrismaClient();

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

function logError(err: unknown): void {
  process.stderr.write(`${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`);
}

async function main() {
  const result = await seedMarketplace(prisma);
  log(`Seeded ${result.instructors} instructors and ${result.slots} open slots.`);
}

main()
  .catch((err: unknown) => {
    logError(err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
