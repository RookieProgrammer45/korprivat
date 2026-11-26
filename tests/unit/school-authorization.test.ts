import { describe, expect, it } from 'vitest';
import {
  type AuthorizationEvent,
  bookingVisibleToOrganization,
  canAcceptPendingRequest,
  decideBookingCreate,
  existingBookingLifecycleAllowed,
  foldAuthorizationEvents,
  listingSurfaces,
  planAuthorizationAppend,
  planBookingModeMigration,
  snapshotOrganizationId,
} from '@/lib/orgs/school-authorization-policy';

const empty = foldAuthorizationEvents([]);

function event(
  partial: Partial<AuthorizationEvent> & Pick<AuthorizationEvent, 'sequence' | 'kind'>,
): AuthorizationEvent {
  return {
    scopes: [],
    decisionVersion: partial.sequence,
    actorUserId: 'rep-1',
    evidenceRef: 'evidence-1',
    note: null,
    idempotencyKey: `key-${partial.sequence}`,
    createdAt: '2026-10-23T00:00:00.000Z',
    ...partial,
  };
}

const representative = {
  userId: 'rep-1',
  verifiedAt: '2026-10-23T00:00:00.000Z',
  evidenceRef: 'mandate-1',
};

describe('school authorization policy', () => {
  it('SC-1 withdraws request_to_book without hiding granted availability, and zero scopes are directory-only', () => {
    const folded = foldAuthorizationEvents([
      event({
        sequence: 1,
        kind: 'grant',
        scopes: ['availability_display', 'request_to_book'],
        decisionVersion: 1,
      }),
      event({
        sequence: 2,
        kind: 'withdraw',
        scopes: ['request_to_book'],
        decisionVersion: 2,
      }),
    ]);
    const surfaces = listingSurfaces({
      bookingMode: 'request',
      folded,
      enforcementOn: true,
    });
    expect(surfaces.availabilityDisplay).toBe(true);
    expect(surfaces.requestToBook).toBe(false);
    expect(
      decideBookingCreate({
        bookingMode: 'request',
        folded,
        enforcementOn: true,
        submittedMode: 'request',
      }),
    ).toEqual({ ok: false, status: 403, code: 'not_authorized_by_school' });

    const zero = listingSurfaces({ bookingMode: 'instant', folded: empty, enforcementOn: true });
    expect(zero.directoryOnly).toBe(true);
    expect(zero.availabilityDisplay).toBe(false);
  });

  it('SC-2 rejects a stale grant after withdrawal and keeps the withdrawn head', () => {
    const head = foldAuthorizationEvents([
      event({ sequence: 1, kind: 'withdraw', scopes: ['request_to_book'], decisionVersion: 1 }),
    ]);
    const stale = planAuthorizationAppend(head, {
      kind: 'grant',
      scopes: ['request_to_book', 'transactional_booking'],
      actorUserId: 'rep-1',
      evidenceRef: 'fresh',
      note: null,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: 'grant-late',
      bookingMode: 'request',
      representative,
      existingIdempotencyKey: null,
    });
    expect(stale).toEqual({ ok: false, code: 'stale' });
    expect(head.withdrawn).toContain('request_to_book');
  });

  it('SC-3 does not treat a certified connection as a grant', () => {
    const decision = decideBookingCreate({
      bookingMode: 'instant',
      folded: empty,
      enforcementOn: true,
      submittedMode: 'instant',
    });
    expect(decision).toEqual({ ok: false, status: 403, code: 'not_authorized_by_school' });
  });

  it('SC-4 keeps lifecycle actions after a withdrawal blocks new requests', () => {
    const folded = foldAuthorizationEvents([
      event({
        sequence: 1,
        kind: 'admin_suspend',
        scopes: ['request_to_book'],
        decisionVersion: 1,
      }),
    ]);
    expect(canAcceptPendingRequest({ bookingMode: 'request', folded, enforcementOn: false })).toBe(
      false,
    );
    expect(
      canAcceptPendingRequest({ bookingMode: 'instant', folded: empty, enforcementOn: false }),
    ).toBe(false);
    expect(existingBookingLifecycleAllowed()).toBe(true);
    expect(
      canAcceptPendingRequest({
        bookingMode: 'request',
        folded: foldAuthorizationEvents([
          event({
            sequence: 1,
            kind: 'grant',
            scopes: ['request_to_book'],
            decisionVersion: 1,
          }),
        ]),
        enforcementOn: false,
      }),
    ).toBe(true);
  });

  it('SC-13 inquiry-only returns no times and no booking scopes', () => {
    const folded = foldAuthorizationEvents([
      event({ sequence: 1, kind: 'grant', scopes: ['inquiry_collection'], decisionVersion: 1 }),
    ]);
    const surfaces = listingSurfaces({ bookingMode: 'instant', folded, enforcementOn: true });
    expect(surfaces.inquiryCollection).toBe(true);
    expect(surfaces.availabilityDisplay).toBe(false);
    expect(surfaces.requestToBook).toBe(false);
    expect(surfaces.transactionalBooking).toBe(false);
    expect(surfaces.directoryOnly).toBe(false);
  });

  it('SC-14 migration creates zero grants and leaves a contact listing restricted', () => {
    const plan = planBookingModeMigration([
      { id: 'sjobo', name: 'Sjöbo Trafikskola', bookingMode: 'contact' },
      { id: 'instant-school', name: 'Instant', bookingMode: 'instant' },
      { id: 'request-school', name: 'Request', bookingMode: 'request' },
    ]);
    expect(plan.grantsCreated).toBe(0);
    expect(plan.counts).toEqual({ instant: 1, request: 1, contact: 1, other: 0 });
    expect(plan.contactListingIds).toEqual(['sjobo']);
    expect(plan.notes.find((note) => note.listingId === 'instant-school')?.note).toContain(
      'not authorization evidence',
    );
    const contact = listingSurfaces({
      bookingMode: 'contact',
      folded: foldAuthorizationEvents([
        event({
          sequence: 1,
          kind: 'grant',
          scopes: ['transactional_booking'],
          decisionVersion: 1,
        }),
      ]),
      enforcementOn: true,
    });
    expect(contact.directoryOnly).toBe(true);
    expect(contact.transactionalBooking).toBe(false);
  });

  it('SC-17 keeps a listing describable while booking surfaces stay off', () => {
    const surfaces = listingSurfaces({
      bookingMode: 'instant',
      folded: empty,
      enforcementOn: true,
    });
    expect(surfaces.directoryOnly).toBe(true);
    expect(surfaces.transactionalBooking).toBe(false);
    expect(surfaces.requestToBook).toBe(false);
  });

  it('SC-19 hides the other organization and pending bindings', () => {
    const bindings = [
      {
        listingId: 'listing-a',
        organizationId: 'org-a',
        state: 'ACTIVE' as const,
        verifiedAt: '2026-10-23T00:00:00.000Z',
      },
      {
        listingId: 'listing-b',
        organizationId: 'org-b',
        state: 'PENDING_REVIEW' as const,
        verifiedAt: null,
      },
    ];
    expect(
      bookingVisibleToOrganization({
        bookingOrganizationId: 'org-a',
        bookingListingId: 'listing-a',
        organizationId: 'org-b',
        bindings,
      }),
    ).toBe(false);
    expect(
      bookingVisibleToOrganization({
        bookingOrganizationId: 'org-a',
        bookingListingId: 'listing-a',
        organizationId: 'org-a',
        bindings,
      }),
    ).toBe(true);
    expect(
      bookingVisibleToOrganization({
        bookingOrganizationId: 'org-b',
        bookingListingId: 'listing-b',
        organizationId: 'org-b',
        bindings,
      }),
    ).toBe(false);
    expect(
      snapshotOrganizationId({
        bindings,
        listingId: 'listing-b',
        legacyOrganizationId: 'org-b',
      }),
    ).toBeNull();
    expect(
      snapshotOrganizationId({
        bindings: [],
        listingId: 'listing-a',
        legacyOrganizationId: 'org-legacy',
      }),
    ).toBeNull();
    expect(
      snapshotOrganizationId({
        bindings: [
          {
            listingId: 'listing-a',
            organizationId: 'org-a',
            state: 'REVOKED',
            verifiedAt: '2026-10-23T00:00:00.000Z',
          },
        ],
        listingId: 'listing-a',
        legacyOrganizationId: 'org-a',
      }),
    ).toBeNull();
    expect(
      snapshotOrganizationId({
        bindings: [
          {
            listingId: 'listing-a',
            organizationId: 'org-a',
            state: 'ACTIVE',
            verifiedAt: '2026-10-23T00:00:00.000Z',
          },
          {
            listingId: 'listing-a',
            organizationId: 'org-c',
            state: 'ACTIVE',
            verifiedAt: '2026-10-24T00:00:00.000Z',
          },
        ],
        listingId: 'listing-a',
        legacyOrganizationId: 'org-a',
      }),
    ).toBeNull();
  });

  it('never treats bookingMode as a grant while enforcement is off', () => {
    const folded = foldAuthorizationEvents([
      event({
        sequence: 1,
        kind: 'withdraw',
        scopes: ['transactional_booking'],
        decisionVersion: 1,
      }),
    ]);
    expect(
      decideBookingCreate({
        bookingMode: 'instant',
        folded,
        enforcementOn: false,
        submittedMode: 'instant',
      }).ok,
    ).toBe(false);
    expect(
      decideBookingCreate({
        bookingMode: 'instant',
        folded: empty,
        enforcementOn: false,
        submittedMode: 'instant',
      }).ok,
    ).toBe(false);
    expect(
      decideBookingCreate({
        bookingMode: 'instant',
        folded: empty,
        enforcementOn: true,
        submittedMode: 'instant',
      }).ok,
    ).toBe(false);
  });

  it('refuses a grant from the listing owner and replays an idempotent command', () => {
    const owner = planAuthorizationAppend(empty, {
      kind: 'grant',
      scopes: ['transactional_booking'],
      actorUserId: 'owner-1',
      evidenceRef: 'note',
      note: null,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: 'grant-1',
      bookingMode: 'instant',
      representative: null,
      existingIdempotencyKey: null,
    });
    expect(owner).toEqual({ ok: false, code: 'not_representative' });

    const locked = planAuthorizationAppend(empty, {
      kind: 'grant',
      scopes: ['transactional_booking'],
      actorUserId: 'rep-1',
      evidenceRef: 'note',
      note: null,
      expectedHeadSequence: 0,
      decisionVersion: 1,
      idempotencyKey: 'grant-contact',
      bookingMode: 'contact',
      representative,
      existingIdempotencyKey: null,
    });
    expect(locked).toEqual({ ok: false, code: 'contact_locked' });

    const replay = planAuthorizationAppend(empty, {
      kind: 'grant',
      scopes: ['transactional_booking'],
      actorUserId: 'rep-1',
      evidenceRef: 'note',
      note: null,
      expectedHeadSequence: 99,
      decisionVersion: 99,
      idempotencyKey: 'grant-1',
      bookingMode: 'instant',
      representative,
      existingIdempotencyKey: 'grant-1',
    });
    expect(replay).toEqual({ ok: true, replay: true });
  });
});
