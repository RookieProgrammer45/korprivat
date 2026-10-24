/**
 * File-based cohort assignment and §6 coverage from the cutover roster.
 * Does not open a database, send outreach, or flip flags.
 *
 * Usage:
 *   npm run cohorts:assign
 *   npm run cohorts:assign -- --pilot-city Malmö --pilot-category B --pilot-limit 10
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assignAuthorizationCohorts,
  buildAuthorizationCoverage,
  type CollectionSchool,
  formatCoverageMarkdown,
} from '../src/lib/orgs/authorization-collection';

type RosterSchool = {
  id: string;
  name: string;
  city: string;
  bookingMode?: string | null;
};

type RosterFile = {
  source?: string;
  schools?: RosterSchool[];
};

type EnrichmentFile = {
  listings?: Record<
    string,
    Partial<
      Pick<
        CollectionSchool,
        | 'categories'
        | 'hasPublishedOffering'
        | 'hasAvailability'
        | 'grantedScopes'
        | 'withdrawnScopes'
        | 'e0e3Pass'
        | 'hasApprovedPolicy'
        | 'hasRequestAcceptanceRoute'
        | 'hasE4Control'
        | 'hasCurrentInventory'
      >
    >
  >;
};

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }
  return process.argv[index + 1];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

function main() {
  const root = resolve(__dirname, '..');
  const rosterPath = resolve(root, argValue('--roster') ?? 'docs/cutover-school-roster.json');
  const enrichmentPath = argValue('--enrichment');
  const outDir = resolve(root, argValue('--out-dir') ?? 'docs');
  const roster = readJson<RosterFile>(rosterPath);
  const enrichment = enrichmentPath
    ? readJson<EnrichmentFile>(resolve(root, enrichmentPath))
    : { listings: {} };

  const schools: CollectionSchool[] = (roster.schools ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    city: row.city,
    bookingMode: row.bookingMode,
    ...(enrichment.listings?.[row.id] ?? {}),
  }));

  const pilotLimitRaw = argValue('--pilot-limit');
  const assignment = assignAuthorizationCohorts({
    schools,
    pilotCity: argValue('--pilot-city'),
    pilotCategory: argValue('--pilot-category'),
    pilotLimit: pilotLimitRaw ? Number(pilotLimitRaw) : undefined,
  });
  const coverage = buildAuthorizationCoverage({ schools, assignment });
  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    source: roster.source ?? rosterPath,
    productionTouched: false,
    flagsChanged: [],
    outreachSent: 0,
    assignment: {
      counts: assignment.counts,
      pilot: assignment.pilot,
      proposedCells: assignment.proposedCells,
      worklists: assignment.worklists,
    },
    coverage,
  };

  mkdirSync(outDir, { recursive: true });
  const jsonPath = resolve(outDir, 'authorization-coverage-report.json');
  const mdPath = resolve(outDir, 'authorization-coverage-report.md');
  const worklistPath = resolve(outDir, 'authorization-cohort-worklists.json');
  writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(
    mdPath,
    formatCoverageMarkdown({
      source: payload.source,
      generatedAt,
      assignment,
      coverage,
    }),
  );
  writeFileSync(
    worklistPath,
    `${JSON.stringify(
      {
        generatedAt,
        source: payload.source,
        counts: assignment.counts,
        pilot: assignment.pilot,
        proposedCells: assignment.proposedCells,
        worklists: assignment.worklists,
      },
      null,
      2,
    )}\n`,
  );

  // CLI summary for operators. The machine report is the JSON files above.
  // biome-ignore lint/suspicious/noConsole: operator stdout
  console.log(
    JSON.stringify(
      {
        rosterPath,
        schools: schools.length,
        counts: assignment.counts,
        buckets: coverage.buckets,
        flipDelta: coverage.flipDelta.schoolsGoingDirectoryOnly.length,
        wrote: [jsonPath, mdPath, worklistPath].map((path) => path.replace(`${root}/`, '')),
      },
      null,
      2,
    ),
  );
}

main();
