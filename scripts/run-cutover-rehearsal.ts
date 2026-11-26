/**
 * Local cutover rehearsal. Sets flags only in this process.
 * Does not write Vercel env, production env, or the database.
 *
 * Usage: npx tsx scripts/run-cutover-rehearsal.ts
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const FLAG_STEPS: Array<{ step: string; flags: string[] }> = [
  { step: '1', flags: ['SCHOOL_AUTHZ_ENFORCEMENT'] },
  { step: '2', flags: ['CANCELLATION_POLICY_ENFORCE'] },
  { step: '3', flags: ['RELIABLE_PROCESSING'] },
  { step: '4', flags: ['CONNECTIVITY_API'] },
  { step: '5', flags: ['CERTIFICATION_ENFORCEMENT'] },
  { step: '6a', flags: ['CLAIM_FUNNEL'] },
  { step: '6b', flags: ['SCHOOL_MEDIATED_INSTRUCTORS'] },
  { step: '6c', flags: ['LEAD_DASHBOARD'] },
  { step: '6d', flags: ['CATEGORY_OFFERINGS'] },
  { step: '6e', flags: ['CONCIERGE_ONBOARDING'] },
  { step: '7', flags: ['OPS_ALERTING'] },
];

const ALL_FLAGS = FLAG_STEPS.flatMap((step) => step.flags);

type RunSummary = {
  exitCode: number;
  passed: number | null;
  failed: number | null;
  files: number | null;
  failures: string[];
};

type StepResult = {
  step: string;
  flags: string[];
  suite: RunSummary;
  scenarios: RunSummary;
};

function parseCounts(output: string): {
  passed: number | null;
  failed: number | null;
  files: number | null;
} {
  const mixed = output.match(/Tests\s+(\d+) failed \| (\d+) passed/);
  const passedOnly = output.match(/Tests\s+(\d+) passed \((\d+)\)/);
  const filesFailed = output.match(/Test Files\s+(\d+) failed \| (\d+) passed/);
  const filesOnly = output.match(/Test Files\s+(\d+) passed/);
  if (mixed) {
    return {
      passed: Number(mixed[2]),
      failed: Number(mixed[1]),
      files: filesFailed ? Number(filesFailed[1]) + Number(filesFailed[2]) : null,
    };
  }
  return {
    passed: passedOnly ? Number(passedOnly[1]) : null,
    failed: 0,
    files: filesOnly ? Number(filesOnly[1]) : null,
  };
}

function runVitest(flagEnv: Record<string, string>, testNamePattern?: string) {
  const env = { ...process.env, ...flagEnv };
  for (const flag of ALL_FLAGS) {
    if (!(flag in flagEnv)) delete env[flag];
  }
  const args = ['vitest', 'run'];
  if (testNamePattern) args.push('-t', testNamePattern);
  const result = spawnSync('npx', args, {
    env,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  return { exitCode: result.status ?? 1, output };
}

function extractFailures(output: string): string[] {
  return output.split('\n').flatMap((line) => {
    const match = line.match(/^ FAIL {2}(.+)$/);
    return match?.[1] ? [match[1]] : [];
  });
}

function summarize(output: string, exitCode: number): RunSummary {
  return { exitCode, ...parseCounts(output), failures: extractFailures(output) };
}

const startedAt = new Date().toISOString();
const results: StepResult[] = [];
const baselineSuite = runVitest({});
const baselineScenarios = runVitest({}, 'SC-');
results.push({
  step: '0-baseline-flags-off',
  flags: [],
  suite: summarize(baselineSuite.output, baselineSuite.exitCode),
  scenarios: summarize(baselineScenarios.output, baselineScenarios.exitCode),
});
process.stdout.write(
  `${JSON.stringify({ step: '0-baseline-flags-off', suite: results[0]?.suite, scenarios: results[0]?.scenarios })}\n`,
);

for (const step of FLAG_STEPS) {
  const flagEnv = Object.fromEntries(step.flags.map((flag) => [flag, '1']));
  const suite = runVitest(flagEnv);
  const scenarios = runVitest(flagEnv, 'SC-');
  results.push({
    step: step.step,
    flags: step.flags,
    suite: summarize(suite.output, suite.exitCode),
    scenarios: summarize(scenarios.output, scenarios.exitCode),
  });
  process.stdout.write(
    `${JSON.stringify({ step: step.step, flags: step.flags, suite: results.at(-1)?.suite, scenarios: results.at(-1)?.scenarios })}\n`,
  );
}

const report = {
  environment: 'local-vitest',
  productionFlagsTouched: false,
  productionSchemaTouched: false,
  startedAt,
  finishedAt: new Date().toISOString(),
  results,
};
const outPath = resolve('docs/cutover-rehearsal-results.json');
writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ wrote: outPath, failedSteps: results.filter((row) => row.suite.exitCode !== 0).map((row) => row.step) })}\n`,
);
process.exit(
  results.some((row) => row.suite.exitCode !== 0 && row.step !== '0-baseline-flags-off') ? 1 : 0,
);
