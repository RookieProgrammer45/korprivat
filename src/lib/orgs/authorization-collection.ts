// File-based cohort assignment and §6 coverage. Reads roster facts only —
// never invents a category, grant, or eligibility check.

import {
  AUTHORIZATION_SCOPES,
  type AuthorizationEvent,
  type AuthorizationScope,
  foldAuthorizationEvents,
  isContactRestriction,
  listingSurfaces,
} from '@/lib/orgs/school-authorization-policy';

export const PROFESSIONAL_CATEGORIES = ['A', 'C', 'D'] as const;
export const TEACHING_CATEGORIES = ['A', 'B', 'C', 'D'] as const;
export const PILOT_LIMIT_DEFAULT = 10;
export const PILOT_LIMIT_MAX = 15;

export type CohortId =
  | '0-pilot'
  | '1-professional'
  | '2-active-core'
  | '3-long-tail'
  | 'excluded-contact'
  | 'unclassified';

export type CollectionSchool = {
  id: string;
  name: string;
  city: string;
  bookingMode?: string | null;
  categories?: string[];
  hasPublishedOffering?: boolean;
  hasAvailability?: boolean;
  grantedScopes?: string[];
  withdrawnScopes?: string[];
  e0e3Pass?: boolean;
  hasApprovedPolicy?: boolean;
  hasRequestAcceptanceRoute?: boolean;
  hasE4Control?: boolean;
  hasCurrentInventory?: boolean;
};

export type CohortAssignment = {
  listingId: string;
  name: string;
  city: string;
  cohort: CohortId;
  categories: string[];
  reason: string;
};

export type ProposedCell = {
  city: string;
  category: string | null;
  count: number;
  reason: 'city-category' | 'city-only-missing-category';
};

export type AssignmentResult = {
  byId: Record<string, CohortAssignment>;
  counts: Record<CohortId, number>;
  worklists: Record<CohortId, CohortAssignment[]>;
  proposedCells: ProposedCell[];
  pilot: {
    city: string;
    category: string;
    limit: number;
    assigned: number;
    spilled: number;
  } | null;
};

export type CoverageCity = {
  schoolCount: number;
  actionEligible: number;
  instantBookable: number;
  availabilityDisplayAuthorized: number;
  directoryOnlyIfEnforcementOn: number;
};

export type CoverageReport = {
  buckets: {
    authorizedByScope: Record<AuthorizationScope, number>;
    actionEligible: number;
    instantBookable: number;
    availabilityDisplayAuthorized: number;
    directoryOnlyToday: number;
    directoryOnlyIfEnforcementOn: number;
  };
  byCity: Record<string, CoverageCity>;
  flipDelta: {
    schoolsGoingDirectoryOnly: string[];
    byCity: Record<string, string[]>;
  };
  missingFacts: string[];
  inventedFacts: string[];
};

const COHORTS: CohortId[] = [
  '0-pilot',
  '1-professional',
  '2-active-core',
  '3-long-tail',
  'excluded-contact',
  'unclassified',
];

const TEACHING_SET = new Set<string>(TEACHING_CATEGORIES);
const PROFESSIONAL_SET = new Set<string>(PROFESSIONAL_CATEGORIES);
const SCOPE_SET = new Set<string>(AUTHORIZATION_SCOPES);

function emptyCounts(): Record<CohortId, number> {
  return {
    '0-pilot': 0,
    '1-professional': 0,
    '2-active-core': 0,
    '3-long-tail': 0,
    'excluded-contact': 0,
    unclassified: 0,
  };
}

function emptyWorklists(): Record<CohortId, CohortAssignment[]> {
  return {
    '0-pilot': [],
    '1-professional': [],
    '2-active-core': [],
    '3-long-tail': [],
    'excluded-contact': [],
    unclassified: [],
  };
}

function emptyScopeCounts(): Record<AuthorizationScope, number> {
  return {
    availability_display: 0,
    inquiry_collection: 0,
    request_to_book: 0,
    transactional_booking: 0,
    payment_collection: 0,
  };
}

function normalizeCity(city: string | undefined): string {
  return (city ?? '').trim();
}

export function normalizeTeachingCategories(values: string[] | undefined): string[] {
  const out: string[] = [];
  for (const value of values ?? []) {
    const category = value.trim().toUpperCase();
    if (TEACHING_SET.has(category) && !out.includes(category)) {
      out.push(category);
    }
  }
  return out;
}

function asScopes(values: string[] | undefined): AuthorizationScope[] {
  const out: AuthorizationScope[] = [];
  for (const value of values ?? []) {
    if (SCOPE_SET.has(value) && !out.includes(value as AuthorizationScope)) {
      out.push(value as AuthorizationScope);
    }
  }
  return out;
}

function clampPilotLimit(limit: number | undefined): number {
  const requested = limit ?? PILOT_LIMIT_DEFAULT;
  if (!Number.isFinite(requested) || requested < 1) {
    return PILOT_LIMIT_DEFAULT;
  }
  return Math.min(Math.floor(requested), PILOT_LIMIT_MAX);
}

function compareSchools(left: CollectionSchool, right: CollectionSchool): number {
  const name = left.name.localeCompare(right.name, 'sv');
  if (name !== 0) {
    return name;
  }
  return left.id.localeCompare(right.id);
}

export function assignAuthorizationCohorts(input: {
  schools: CollectionSchool[];
  pilotCity?: string;
  pilotCategory?: string;
  pilotLimit?: number;
}): AssignmentResult {
  const seen = new Set<string>();
  const unique = input.schools.filter((row) => {
    if (seen.has(row.id)) {
      return false;
    }
    seen.add(row.id);
    return true;
  });
  unique.sort(compareSchools);

  const pilotCity = normalizeCity(input.pilotCity);
  const pilotCategory =
    normalizeTeachingCategories(input.pilotCategory ? [input.pilotCategory] : [])[0] ?? '';
  const pilotReady = pilotCity.length > 0 && pilotCategory.length > 0;
  const limit = clampPilotLimit(input.pilotLimit);
  let pilotAssigned = 0;
  let pilotEligible = 0;

  const byId: Record<string, CohortAssignment> = {};
  const counts = emptyCounts();
  const worklists = emptyWorklists();

  for (const row of unique) {
    const city = normalizeCity(row.city);
    const categories = normalizeTeachingCategories(row.categories);
    let cohort: CohortId;
    let reason: string;

    if (isContactRestriction(row.bookingMode)) {
      cohort = 'excluded-contact';
      reason = 'contact_restriction';
    } else if (!city || categories.length === 0) {
      cohort = 'unclassified';
      reason = !city ? 'missing_city' : 'missing_category';
    } else if (
      pilotReady &&
      city.toLocaleLowerCase('sv') === pilotCity.toLocaleLowerCase('sv') &&
      categories.includes(pilotCategory)
    ) {
      pilotEligible += 1;
      if (pilotAssigned < limit) {
        cohort = '0-pilot';
        reason = 'pilot_cell';
        pilotAssigned += 1;
      } else if (categories.some((category) => PROFESSIONAL_SET.has(category))) {
        cohort = '1-professional';
        reason = 'pilot_spill_professional';
      } else if (row.hasPublishedOffering === true || row.hasAvailability === true) {
        cohort = '2-active-core';
        reason = 'pilot_spill_active_core';
      } else {
        cohort = '3-long-tail';
        reason = 'pilot_spill_long_tail';
      }
    } else if (categories.some((category) => PROFESSIONAL_SET.has(category))) {
      cohort = '1-professional';
      reason = 'professional_category';
    } else if (row.hasPublishedOffering === true || row.hasAvailability === true) {
      cohort = '2-active-core';
      reason = 'published_offering_or_availability';
    } else {
      cohort = '3-long-tail';
      reason = 'classified_without_published_supply';
    }

    const assignment: CohortAssignment = {
      listingId: row.id,
      name: row.name,
      city,
      cohort,
      categories,
      reason,
    };
    byId[row.id] = assignment;
    counts[cohort] += 1;
    worklists[cohort].push(assignment);
  }

  return {
    byId,
    counts,
    worklists,
    proposedCells: proposeCells(unique),
    pilot: pilotReady
      ? {
          city: pilotCity,
          category: pilotCategory,
          limit,
          assigned: pilotAssigned,
          spilled: Math.max(0, pilotEligible - pilotAssigned),
        }
      : null,
  };
}

export function proposeCells(schools: CollectionSchool[]): ProposedCell[] {
  const counts = new Map<string, ProposedCell>();
  const seen = new Set<string>();
  for (const row of schools) {
    if (seen.has(row.id) || isContactRestriction(row.bookingMode)) {
      continue;
    }
    seen.add(row.id);
    const city = normalizeCity(row.city);
    if (!city) {
      continue;
    }
    const categories = normalizeTeachingCategories(row.categories);
    if (categories.length === 0) {
      const key = `${city.toLocaleLowerCase('sv')}::`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, {
          city,
          category: null,
          count: 1,
          reason: 'city-only-missing-category',
        });
      }
      continue;
    }
    for (const category of categories) {
      const key = `${city.toLocaleLowerCase('sv')}::${category}`;
      const existing = counts.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        counts.set(key, { city, category, count: 1, reason: 'city-category' });
      }
    }
  }
  return [...counts.values()].sort((left, right) => {
    const city = left.city.localeCompare(right.city, 'sv');
    if (city !== 0) {
      return city;
    }
    return (left.category ?? '').localeCompare(right.category ?? '', 'sv');
  });
}

function syntheticEvents(school: CollectionSchool): AuthorizationEvent[] {
  const granted = asScopes(school.grantedScopes);
  const withdrawn = asScopes(school.withdrawnScopes);
  const events: AuthorizationEvent[] = [];
  if (granted.length > 0) {
    events.push({
      sequence: 1,
      kind: 'grant',
      scopes: granted,
      decisionVersion: 1,
      actorUserId: 'coverage',
      evidenceRef: 'roster-grant',
      note: null,
      idempotencyKey: `${school.id}-grant`,
      createdAt: '2026-10-24T00:00:00.000Z',
    });
  }
  if (withdrawn.length > 0) {
    events.push({
      sequence: events.length + 1,
      kind: 'withdraw',
      scopes: withdrawn,
      decisionVersion: events.length + 1,
      actorUserId: 'coverage',
      evidenceRef: 'roster-withdraw',
      note: null,
      idempotencyKey: `${school.id}-withdraw`,
      createdAt: '2026-10-24T00:00:00.000Z',
    });
  }
  return events;
}

function cityBucket(byCity: Record<string, CoverageCity>, city: string): CoverageCity {
  const key = city || 'unclassified-city';
  const existing = byCity[key];
  if (existing) {
    return existing;
  }
  const created: CoverageCity = {
    schoolCount: 0,
    actionEligible: 0,
    instantBookable: 0,
    availabilityDisplayAuthorized: 0,
    directoryOnlyIfEnforcementOn: 0,
  };
  byCity[key] = created;
  return created;
}

export function buildAuthorizationCoverage(input: {
  schools: CollectionSchool[];
  assignment: AssignmentResult;
}): CoverageReport {
  const authorizedByScope = emptyScopeCounts();
  const missing = new Set<string>();
  const byCity: Record<string, CoverageCity> = {};
  const flipIds: string[] = [];
  const flipByCity: Record<string, string[]> = {};
  let actionEligible = 0;
  let instantBookable = 0;
  let availabilityDisplayAuthorized = 0;
  let directoryOnlyToday = 0;
  let directoryOnlyIfEnforcementOn = 0;

  const seen = new Set<string>();
  for (const row of input.schools) {
    if (seen.has(row.id)) {
      continue;
    }
    seen.add(row.id);
    const folded = foldAuthorizationEvents(syntheticEvents(row));
    const today = listingSurfaces({
      bookingMode: row.bookingMode,
      folded,
      enforcementOn: false,
    });
    const flip = listingSurfaces({
      bookingMode: row.bookingMode,
      folded,
      enforcementOn: true,
    });
    const contact = isContactRestriction(row.bookingMode);
    const liveGranted = contact
      ? []
      : folded.granted.filter((scope) => !folded.withdrawn.includes(scope));

    for (const scope of liveGranted) {
      authorizedByScope[scope] += 1;
    }

    const e0e3 = row.e0e3Pass === true;
    const policy = row.hasApprovedPolicy === true;
    const requestRoute = row.hasRequestAcceptanceRoute === true;
    if (row.e0e3Pass === undefined) {
      missing.add('e0e3');
    }
    if (row.hasApprovedPolicy === undefined) {
      missing.add('approved_policy');
    }
    if (row.hasRequestAcceptanceRoute === undefined) {
      missing.add('request_acceptance_route');
    }
    if (row.hasE4Control === undefined) {
      missing.add('e4_control');
    }
    if (row.hasCurrentInventory === undefined) {
      missing.add('current_inventory');
    }

    const eligible =
      !contact && e0e3 && policy && requestRoute && (flip.requestToBook || flip.inquiryCollection);
    const instant =
      eligible &&
      row.hasE4Control === true &&
      row.hasCurrentInventory === true &&
      flip.transactionalBooking;

    if (eligible) {
      actionEligible += 1;
    }
    if (instant) {
      instantBookable += 1;
    }
    if (flip.availabilityDisplay) {
      availabilityDisplayAuthorized += 1;
    }
    if (today.directoryOnly) {
      directoryOnlyToday += 1;
    }
    if (flip.directoryOnly) {
      directoryOnlyIfEnforcementOn += 1;
    }
    if (!today.directoryOnly && flip.directoryOnly) {
      flipIds.push(row.id);
      const city = normalizeCity(row.city) || 'unclassified-city';
      flipByCity[city] = [...(flipByCity[city] ?? []), row.id];
    }

    const city = cityBucket(byCity, normalizeCity(row.city));
    city.schoolCount += 1;
    if (eligible) {
      city.actionEligible += 1;
    }
    if (instant) {
      city.instantBookable += 1;
    }
    if (flip.availabilityDisplay) {
      city.availabilityDisplayAuthorized += 1;
    }
    if (flip.directoryOnly) {
      city.directoryOnlyIfEnforcementOn += 1;
    }
  }

  void input.assignment;

  return {
    buckets: {
      authorizedByScope,
      actionEligible,
      instantBookable,
      availabilityDisplayAuthorized,
      directoryOnlyToday,
      directoryOnlyIfEnforcementOn,
    },
    byCity,
    flipDelta: {
      schoolsGoingDirectoryOnly: flipIds,
      byCity: flipByCity,
    },
    missingFacts: [...missing].sort(),
    inventedFacts: [],
  };
}

export function formatCoverageMarkdown(input: {
  source: string;
  generatedAt: string;
  assignment: AssignmentResult;
  coverage: CoverageReport;
}): string {
  const { assignment, coverage } = input;
  const scopeLines = AUTHORIZATION_SCOPES.map(
    (scope) => `- ${scope}: ${coverage.buckets.authorizedByScope[scope]}`,
  ).join('\n');
  const cohortLines = COHORTS.map((cohort) => `- ${cohort}: ${assignment.counts[cohort]}`).join(
    '\n',
  );
  const cellLines = assignment.proposedCells
    .slice(0, 20)
    .map(
      (cell) =>
        `- ${cell.city}${cell.category ? ` × ${cell.category}` : ' (no category)'}: ${cell.count} (${cell.reason})`,
    )
    .join('\n');
  const cityLines = Object.entries(coverage.byCity)
    .sort(([left], [right]) => left.localeCompare(right, 'sv'))
    .map(
      ([city, row]) =>
        `- ${city}: ${row.schoolCount} schools, ${row.actionEligible} action-eligible, ${row.directoryOnlyIfEnforcementOn} directory-only on flip`,
    )
    .join('\n');

  return `# Authorization collection coverage

Generated: ${input.generatedAt}
Source: ${input.source}

This is the go/no-go input from \`docs/authorization-collection-plan.md\` §6 and §10.
Grant counts are not usable supply. No production flag was changed.

## §6 buckets

${scopeLines}
- action-eligible (E0–E3 + approved policy + request-acceptance route): ${coverage.buckets.actionEligible}
- instant-bookable (action-eligible + E4 + current inventory): ${coverage.buckets.instantBookable}
- availability-display-authorized: ${coverage.buckets.availabilityDisplayAuthorized}
- directory-only today: ${coverage.buckets.directoryOnlyToday}
- directory-only if \`SCHOOL_AUTHZ_ENFORCEMENT\` is on: ${coverage.buckets.directoryOnlyIfEnforcementOn}

## Cohort assignment

${cohortLines}

Pilot cell: ${
    assignment.pilot
      ? `${assignment.pilot.city} × ${assignment.pilot.category} (limit ${assignment.pilot.limit}, assigned ${assignment.pilot.assigned}, spilled ${assignment.pilot.spilled})`
      : 'not selected — pass --pilot-city and --pilot-category'
  }

## Proposed cells (first 20)

${cellLines || '- none'}

## Hypothetical flip delta

Schools that are bookable via legacy \`bookingMode\` today and would become directory-only: **${coverage.flipDelta.schoolsGoingDirectoryOnly.length}**.

## Per-city density (eligible offerings, not grant counts)

${cityLines || '- none'}

## Missing facts (not invented)

${coverage.missingFacts.map((fact) => `- ${fact}`).join('\n') || '- none'}

## Invented facts

${coverage.inventedFacts.length === 0 ? '- none' : coverage.inventedFacts.map((fact) => `- ${fact}`).join('\n')}
`;
}
