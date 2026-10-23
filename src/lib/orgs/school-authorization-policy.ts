// Pure authorization rules for Phase 1. No Prisma, no server-only — routes and
// tests share this so a withdrawal cannot drift from the UI surface flags.

export const AUTHORIZATION_SCOPES = [
  'availability_display',
  'inquiry_collection',
  'request_to_book',
  'transactional_booking',
  'payment_collection',
] as const;

export type AuthorizationScope = (typeof AUTHORIZATION_SCOPES)[number];
export type AuthorizationEventKind = 'grant' | 'withdraw' | 'admin_suspend';

const SCOPE_SET = new Set<string>(AUTHORIZATION_SCOPES);

export type AuthorizationEvent = {
  sequence: number;
  kind: AuthorizationEventKind;
  scopes: string[];
  decisionVersion: number;
  actorUserId: string;
  evidenceRef: string | null;
  note: string | null;
  idempotencyKey: string;
  createdAt: string;
};

export type FoldedAuthorization = {
  granted: AuthorizationScope[];
  withdrawn: AuthorizationScope[];
  decisionVersion: number;
  headSequence: number;
};

export type SurfacePermissions = {
  availabilityDisplay: boolean;
  inquiryCollection: boolean;
  requestToBook: boolean;
  transactionalBooking: boolean;
  directoryOnly: boolean;
};

export type RepresentativeAuthority = {
  userId: string;
  verifiedAt: string;
  evidenceRef: string;
};

export function isSchoolAuthzEnforcementOn(
  env: string | undefined = process.env.SCHOOL_AUTHZ_ENFORCEMENT,
): boolean {
  return env === '1' || env === 'true';
}

export function isContactRestriction(bookingMode: string | null | undefined): boolean {
  return bookingMode === 'contact';
}

function asScopes(values: string[]): AuthorizationScope[] {
  const out: AuthorizationScope[] = [];
  for (const value of values) {
    if (SCOPE_SET.has(value) && !out.includes(value as AuthorizationScope)) {
      out.push(value as AuthorizationScope);
    }
  }
  return out;
}

export function foldAuthorizationEvents(events: AuthorizationEvent[]): FoldedAuthorization {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let granted = new Set<AuthorizationScope>();
  const denied = new Set<AuthorizationScope>();
  let decisionVersion = 0;
  let headSequence = 0;
  for (const event of ordered) {
    headSequence = event.sequence;
    decisionVersion = event.decisionVersion;
    const scopes = asScopes(event.scopes);
    if (event.kind === 'grant') {
      granted = new Set(scopes);
      for (const scope of scopes) denied.delete(scope);
      continue;
    }
    for (const scope of scopes) {
      granted.delete(scope);
      denied.add(scope);
    }
  }
  return {
    granted: [...granted],
    withdrawn: [...denied],
    decisionVersion,
    headSequence,
  };
}

function fromBookingMode(bookingMode: string | null | undefined): SurfacePermissions {
  if (isContactRestriction(bookingMode)) {
    return {
      availabilityDisplay: false,
      inquiryCollection: false,
      requestToBook: false,
      transactionalBooking: false,
      directoryOnly: true,
    };
  }
  if (bookingMode === 'request') {
    return {
      availabilityDisplay: true,
      inquiryCollection: true,
      requestToBook: true,
      transactionalBooking: false,
      directoryOnly: false,
    };
  }
  return {
    availabilityDisplay: true,
    inquiryCollection: true,
    requestToBook: false,
    transactionalBooking: true,
    directoryOnly: false,
  };
}

function fromGrants(granted: AuthorizationScope[]): SurfacePermissions {
  const has = (scope: AuthorizationScope) => granted.includes(scope);
  const availabilityDisplay = has('availability_display');
  const inquiryCollection = has('inquiry_collection');
  const requestToBook = has('request_to_book');
  const transactionalBooking = has('transactional_booking');
  return {
    availabilityDisplay,
    inquiryCollection,
    requestToBook,
    transactionalBooking,
    directoryOnly:
      !availabilityDisplay && !inquiryCollection && !requestToBook && !transactionalBooking,
  };
}

export function surfacePermissions(input: {
  bookingMode: string | null | undefined;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
}): SurfacePermissions {
  if (isContactRestriction(input.bookingMode)) {
    return fromBookingMode('contact');
  }
  const base = input.enforcementOn
    ? fromGrants(input.folded.granted.filter((scope) => !input.folded.withdrawn.includes(scope)))
    : fromBookingMode(input.bookingMode);
  const withdrawn = new Set(input.folded.withdrawn);
  return {
    availabilityDisplay: base.availabilityDisplay && !withdrawn.has('availability_display'),
    inquiryCollection: base.inquiryCollection && !withdrawn.has('inquiry_collection'),
    requestToBook: base.requestToBook && !withdrawn.has('request_to_book'),
    transactionalBooking: base.transactionalBooking && !withdrawn.has('transactional_booking'),
    directoryOnly: false,
  };
}

export function withDirectoryFlag(surfaces: SurfacePermissions): SurfacePermissions {
  if (isClosed(surfaces)) {
    return { ...surfaces, directoryOnly: true };
  }
  return { ...surfaces, directoryOnly: surfaces.directoryOnly };
}

function isClosed(surfaces: SurfacePermissions): boolean {
  return (
    !surfaces.availabilityDisplay &&
    !surfaces.inquiryCollection &&
    !surfaces.requestToBook &&
    !surfaces.transactionalBooking
  );
}

export function listingSurfaces(input: {
  bookingMode: string | null | undefined;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
}): SurfacePermissions {
  return withDirectoryFlag(surfacePermissions(input));
}

export type BookingCreateDecision =
  | { ok: true; mode: 'instant' | 'request' }
  | { ok: false; status: 403; code: 'not_authorized_by_school' }
  | { ok: false; status: 409; code: 'mode_mismatch' };

export function decideBookingCreate(input: {
  bookingMode: string | null | undefined;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
  submittedMode: 'instant' | 'request' | null | undefined;
}): BookingCreateDecision {
  const surfaces = listingSurfaces(input);
  const legacyMode = input.bookingMode === 'request' ? 'request' : 'instant';
  const mode = input.submittedMode ?? (input.enforcementOn ? null : legacyMode);
  if (input.enforcementOn) {
    if (mode === 'request') {
      return surfaces.requestToBook
        ? { ok: true, mode: 'request' }
        : { ok: false, status: 403, code: 'not_authorized_by_school' };
    }
    if (mode === 'instant') {
      return surfaces.transactionalBooking
        ? { ok: true, mode: 'instant' }
        : { ok: false, status: 403, code: 'not_authorized_by_school' };
    }
    return { ok: false, status: 403, code: 'not_authorized_by_school' };
  }
  if (isContactRestriction(input.bookingMode) || isClosed(surfaces)) {
    return { ok: false, status: 403, code: 'not_authorized_by_school' };
  }
  const resolved = mode === 'request' || mode === 'instant' ? mode : legacyMode;
  if (resolved === 'request' && !surfaces.requestToBook) {
    return { ok: false, status: 403, code: 'not_authorized_by_school' };
  }
  if (resolved === 'instant' && !surfaces.transactionalBooking) {
    return { ok: false, status: 403, code: 'not_authorized_by_school' };
  }
  if (resolved !== legacyMode) {
    return { ok: false, status: 409, code: 'mode_mismatch' };
  }
  return { ok: true, mode: resolved };
}

export function canAcceptPendingRequest(input: {
  bookingMode: string | null | undefined;
  folded: FoldedAuthorization;
  enforcementOn: boolean;
}): boolean {
  if (isContactRestriction(input.bookingMode)) return false;
  if (input.folded.withdrawn.includes('request_to_book')) return false;
  if (!input.enforcementOn) return true;
  return input.folded.granted.includes('request_to_book');
}

/** Cancel, refund, dispute, support, and checkout of an existing booking. */
export function existingBookingLifecycleAllowed(): true {
  return true;
}

export type AppendCommand = {
  kind: AuthorizationEventKind;
  scopes: string[];
  actorUserId: string;
  evidenceRef: string | null;
  note: string | null;
  expectedHeadSequence: number;
  decisionVersion: number;
  idempotencyKey: string;
  bookingMode: string | null | undefined;
  representative: RepresentativeAuthority | null;
  existingIdempotencyKey: string | null;
};

export type AppendPlan =
  | { ok: true; replay: true }
  | {
      ok: true;
      replay: false;
      sequence: number;
      decisionVersion: number;
      scopes: AuthorizationScope[];
    }
  | { ok: false; code: 'stale' | 'not_representative' | 'evidence_required' | 'contact_locked' };

export function planAuthorizationAppend(
  head: FoldedAuthorization,
  command: AppendCommand,
): AppendPlan {
  if (
    command.existingIdempotencyKey != null &&
    command.existingIdempotencyKey === command.idempotencyKey
  ) {
    return { ok: true, replay: true };
  }
  if (command.expectedHeadSequence !== head.headSequence) return { ok: false, code: 'stale' };
  if (command.decisionVersion !== head.decisionVersion + 1) return { ok: false, code: 'stale' };
  const scopes = asScopes(command.scopes);
  if (command.kind === 'grant') {
    if (
      !command.representative ||
      command.representative.userId !== command.actorUserId ||
      !command.representative.verifiedAt ||
      !command.representative.evidenceRef
    ) {
      return { ok: false, code: 'not_representative' };
    }
    if (!command.evidenceRef?.trim()) return { ok: false, code: 'evidence_required' };
    if (isContactRestriction(command.bookingMode)) {
      return { ok: false, code: 'contact_locked' };
    }
  } else if (!command.evidenceRef?.trim()) {
    return { ok: false, code: 'evidence_required' };
  }
  return {
    ok: true,
    replay: false,
    sequence: head.headSequence + 1,
    decisionVersion: command.decisionVersion,
    scopes,
  };
}

export type MigrationListing = { id: string; name: string; bookingMode: string | null };

export function planBookingModeMigration(rows: MigrationListing[]): {
  counts: { instant: number; request: number; contact: number; other: number };
  notes: { listingId: string; bookingMode: string; note: string }[];
  grantsCreated: 0;
  contactListingIds: string[];
} {
  const counts = { instant: 0, request: 0, contact: 0, other: 0 };
  const notes: { listingId: string; bookingMode: string; note: string }[] = [];
  const contactListingIds: string[] = [];
  for (const row of rows) {
    const mode = row.bookingMode;
    if (mode === 'instant' || mode === 'request' || mode === 'contact') counts[mode] += 1;
    else counts.other += 1;
    if (mode === 'contact') contactListingIds.push(row.id);
    notes.push({
      listingId: row.id,
      bookingMode: mode ?? 'null',
      note:
        mode === 'contact'
          ? 'historical contact restriction — not authorization evidence; must stay restricted'
          : 'historical bookingMode config, not authorization evidence',
    });
  }
  return { counts, notes, grantsCreated: 0, contactListingIds };
}

export type OrgBindingState = 'ACTIVE' | 'PENDING_REVIEW' | 'REVOKED';

export type ListingBinding = {
  listingId: string;
  organizationId: string;
  state: OrgBindingState;
  verifiedAt: string | null;
};

/** Empty binding table keeps the legacy snapshot. Any row for the listing ends that fallback. */
export function snapshotOrganizationId(input: {
  bindings: ListingBinding[];
  listingId: string;
  legacyOrganizationId: string | null;
}): string | null {
  const mine = input.bindings.filter((row) => row.listingId === input.listingId);
  if (mine.length === 0) return input.legacyOrganizationId;
  const active = mine.find((row) => row.state === 'ACTIVE' && row.verifiedAt);
  return active?.organizationId ?? null;
}

export function bookingVisibleToOrganization(input: {
  bookingOrganizationId: string | null;
  bookingListingId: string;
  organizationId: string;
  bindings: ListingBinding[];
}): boolean {
  const mine = input.bindings.filter((row) => row.listingId === input.bookingListingId);
  if (mine.length === 0) return input.bookingOrganizationId === input.organizationId;
  const active = mine.find((row) => row.state === 'ACTIVE' && row.verifiedAt);
  if (!active) return false;
  return (
    active.organizationId === input.organizationId &&
    input.bookingOrganizationId === input.organizationId
  );
}
