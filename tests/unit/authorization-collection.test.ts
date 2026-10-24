import { describe, expect, it } from 'vitest';
import {
  assignAuthorizationCohorts,
  buildAuthorizationCoverage,
  type CollectionSchool,
  PROFESSIONAL_CATEGORIES,
} from '@/lib/orgs/authorization-collection';

function school(
  partial: Partial<CollectionSchool> & Pick<CollectionSchool, 'id'>,
): CollectionSchool {
  return {
    name: partial.name ?? `School ${partial.id}`,
    city: partial.city ?? 'Malmö',
    bookingMode: partial.bookingMode ?? 'instant',
    ...partial,
  };
}

describe('assignAuthorizationCohorts', () => {
  it('excludes a contact-restricted listing and never invents a category', () => {
    const result = assignAuthorizationCohorts({
      schools: [
        school({
          id: 'sjobo',
          name: 'Sjöbo Trafikskola',
          city: 'Borås',
          bookingMode: 'contact',
        }),
        school({ id: 'no-cat', name: 'Okänd Trafikskola', city: 'Malmö' }),
      ],
    });

    expect(result.byId.sjobo?.cohort).toBe('excluded-contact');
    expect(result.byId['no-cat']?.cohort).toBe('unclassified');
    expect(result.counts['excluded-contact']).toBe(1);
    expect(result.counts.unclassified).toBe(1);
    expect(result.counts['0-pilot']).toBe(0);
    expect(result.counts['1-professional']).toBe(0);
  });

  it('assigns each school once, with A/C/D before active-core and long-tail', () => {
    const result = assignAuthorizationCohorts({
      schools: [
        school({
          id: 'pro',
          categories: ['C'],
          hasPublishedOffering: true,
          hasAvailability: true,
        }),
        school({
          id: 'core',
          categories: ['B'],
          hasPublishedOffering: true,
        }),
        school({ id: 'tail', categories: ['B'] }),
      ],
    });

    expect(result.byId.pro?.cohort).toBe('1-professional');
    expect(result.byId.core?.cohort).toBe('2-active-core');
    expect(result.byId.tail?.cohort).toBe('3-long-tail');
    expect(Object.keys(result.byId)).toHaveLength(3);
  });

  it('fills a capacity-limited city/category pilot cell and spills the rest', () => {
    const schools = Array.from({ length: 12 }, (_, index) =>
      school({
        id: `b-${String(index).padStart(2, '0')}`,
        name: `B School ${index}`,
        city: 'Malmö',
        categories: ['B'],
      }),
    );
    const result = assignAuthorizationCohorts({
      schools: [...schools, school({ id: 'other-city', city: 'Lund', categories: ['B'] })],
      pilotCity: 'Malmö',
      pilotCategory: 'B',
      pilotLimit: 10,
    });

    expect(result.counts['0-pilot']).toBe(10);
    expect(result.counts['3-long-tail']).toBe(3);
    expect(result.byId['other-city']?.cohort).toBe('3-long-tail');
    expect(result.pilot).toEqual({
      city: 'Malmö',
      category: 'B',
      limit: 10,
      assigned: 10,
      spilled: 2,
    });
  });

  it('clamps the pilot ceiling at 15 and refuses a city-only pilot cell', () => {
    const over = assignAuthorizationCohorts({
      schools: [school({ id: 'one', categories: ['B'] })],
      pilotCity: 'Malmö',
      pilotCategory: 'B',
      pilotLimit: 40,
    });
    expect(over.pilot?.limit).toBe(15);

    const cityOnly = assignAuthorizationCohorts({
      schools: [school({ id: 'one', categories: ['B'] })],
      pilotCity: 'Malmö',
    });
    expect(cityOnly.pilot).toBeNull();
    expect(cityOnly.byId.one?.cohort).toBe('3-long-tail');
  });

  it('proposes city/category cells without assigning a default pilot', () => {
    const result = assignAuthorizationCohorts({
      schools: [
        school({ id: 'a1', city: 'Malmö', categories: ['A'] }),
        school({ id: 'b1', city: 'Malmö', categories: ['B'] }),
        school({ id: 'plain', city: 'Göteborg' }),
      ],
    });
    expect(result.proposedCells).toEqual([
      { city: 'Göteborg', category: null, count: 1, reason: 'city-only-missing-category' },
      { city: 'Malmö', category: 'A', count: 1, reason: 'city-category' },
      { city: 'Malmö', category: 'B', count: 1, reason: 'city-category' },
    ]);
    expect(result.counts['0-pilot']).toBe(0);
  });
});

describe('buildAuthorizationCoverage', () => {
  it('counts the five §6 buckets without treating legacy bookingMode as supply', () => {
    const schools = [
      school({ id: 'contact', bookingMode: 'contact', city: 'Borås' }),
      school({ id: 'legacy', bookingMode: 'instant', city: 'Malmö' }),
      school({
        id: 'granted',
        city: 'Malmö',
        bookingMode: 'request',
        categories: ['B'],
        grantedScopes: ['availability_display', 'request_to_book'],
        e0e3Pass: true,
        hasApprovedPolicy: true,
        hasRequestAcceptanceRoute: true,
      }),
    ];

    const coverage = buildAuthorizationCoverage({
      schools,
      assignment: assignAuthorizationCohorts({ schools }),
    });

    expect(coverage.buckets.authorizedByScope).toEqual({
      availability_display: 1,
      inquiry_collection: 0,
      request_to_book: 1,
      transactional_booking: 0,
      payment_collection: 0,
    });
    expect(coverage.buckets.actionEligible).toBe(1);
    expect(coverage.buckets.instantBookable).toBe(0);
    expect(coverage.buckets.availabilityDisplayAuthorized).toBe(1);
    expect(coverage.buckets.directoryOnlyIfEnforcementOn).toBe(2);
    expect(coverage.buckets.directoryOnlyToday).toBe(1);
    expect(coverage.flipDelta.schoolsGoingDirectoryOnly).toEqual(['legacy']);
    expect(coverage.byCity.Malmö?.actionEligible).toBe(1);
    expect(coverage.byCity.Malmö?.directoryOnlyIfEnforcementOn).toBe(1);
    expect(coverage.inventedFacts).toEqual([]);
  });

  it('does not count a grant as action-eligible when E0–E3 or policy is missing', () => {
    const schools = [
      school({
        id: 'partial',
        categories: ['B'],
        grantedScopes: ['request_to_book'],
      }),
    ];
    const coverage = buildAuthorizationCoverage({
      schools,
      assignment: assignAuthorizationCohorts({ schools }),
    });
    expect(coverage.buckets.authorizedByScope.request_to_book).toBe(1);
    expect(coverage.buckets.actionEligible).toBe(0);
    expect(coverage.missingFacts).toContain('e0e3');
    expect(coverage.missingFacts).toContain('approved_policy');
    expect(coverage.missingFacts).toContain('request_acceptance_route');
  });

  it('treats contact restriction as directory-only even with a grant record', () => {
    const schools = [
      school({
        id: 'locked',
        bookingMode: 'contact',
        grantedScopes: ['transactional_booking'],
        e0e3Pass: true,
        hasApprovedPolicy: true,
        hasRequestAcceptanceRoute: true,
        hasE4Control: true,
        hasCurrentInventory: true,
      }),
    ];
    const coverage = buildAuthorizationCoverage({
      schools,
      assignment: assignAuthorizationCohorts({ schools }),
    });
    expect(coverage.buckets.authorizedByScope.transactional_booking).toBe(0);
    expect(coverage.buckets.actionEligible).toBe(0);
    expect(coverage.buckets.instantBookable).toBe(0);
    expect(coverage.buckets.directoryOnlyIfEnforcementOn).toBe(1);
  });
});

describe('constants', () => {
  it('keeps professional categories as A/C/D only', () => {
    expect(PROFESSIONAL_CATEGORIES).toEqual(['A', 'C', 'D']);
  });
});
