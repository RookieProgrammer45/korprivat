/**
 * Local milestone 4/5 harness. Prints a report and exits.
 * Does not open a database connection and does not write certification rows.
 *
 * Usage: npx tsx scripts/run-milestone-harness.ts
 */
import {
  HARNESS_EXTERNAL,
  harnessEvidenceDecision,
  referenceHarnessVendor,
  runMilestoneHarness,
} from '../src/lib/certification/milestone-harness';

const report = runMilestoneHarness(referenceHarnessVendor);
const evidence = harnessEvidenceDecision(report);
process.stdout.write(
  `${JSON.stringify({ report, evidence, external: HARNESS_EXTERNAL }, null, 2)}\n`,
);
if (!report.milestone4LocalPass || evidence.allowed || evidence.milestone5 !== 'partner_external') {
  process.exit(1);
}
