import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  type AppendCommand,
  type AuthorizationEvent,
  type AuthorizationEventKind,
  type AuthorizationScope,
  type FoldedAuthorization,
  foldAuthorizationEvents,
  isSchoolAuthzEnforcementOn,
  type ListingBinding,
  listingSurfaces,
  planAuthorizationAppend,
  type SurfacePermissions,
} from '@/lib/orgs/school-authorization-policy';

export class AuthorizationCommandError extends Error {
  constructor(
    readonly code:
      | 'stale'
      | 'not_representative'
      | 'evidence_required'
      | 'contact_locked'
      | 'no_scopes_selected',
  ) {
    super(code);
    this.name = 'AuthorizationCommandError';
  }
}

type EventRow = {
  sequence: number;
  kind: string;
  scopes: string[];
  decisionVersion: number;
  actorUserId: string;
  evidenceRef: string | null;
  note: string | null;
  idempotencyKey: string;
  createdAt: Date;
};

function toEvent(row: EventRow): AuthorizationEvent {
  return {
    sequence: row.sequence,
    kind: row.kind as AuthorizationEventKind,
    scopes: row.scopes,
    decisionVersion: row.decisionVersion,
    actorUserId: row.actorUserId,
    evidenceRef: row.evidenceRef,
    note: row.note,
    idempotencyKey: row.idempotencyKey,
    createdAt: row.createdAt.toISOString(),
  };
}

type EventDelegate = {
  findMany: (args: unknown) => Promise<EventRow[]>;
  findUnique: (args: unknown) => Promise<(EventRow & { id: string }) | null>;
  create: (args: unknown) => Promise<EventRow & { id: string }>;
};

function eventDelegate(): EventDelegate | null {
  const client = prisma as unknown as { schoolAuthorizationEvent?: EventDelegate };
  return client.schoolAuthorizationEvent ?? null;
}

export async function loadFoldedAuthorization(listingId: string): Promise<FoldedAuthorization> {
  const events = eventDelegate();
  if (!events) return foldAuthorizationEvents([]);
  const rows = await events.findMany({
    where: { listingId },
    orderBy: { sequence: 'asc' },
  });
  return foldAuthorizationEvents(rows.map(toEvent));
}

export async function loadListingSurfaces(
  listingId: string,
  bookingMode: string | null | undefined,
): Promise<SurfacePermissions> {
  const folded = await loadFoldedAuthorization(listingId);
  return listingSurfaces({
    bookingMode,
    folded,
    enforcementOn: isSchoolAuthzEnforcementOn(),
  });
}

export async function loadFoldsByListing(
  listingIds: string[],
): Promise<Map<string, FoldedAuthorization>> {
  const map = new Map<string, FoldedAuthorization>();
  if (listingIds.length === 0) return map;
  const events = eventDelegate();
  if (!events) return map;
  const rows = await events.findMany({
    where: { listingId: { in: listingIds } },
    orderBy: { sequence: 'asc' },
  });
  const grouped = new Map<string, AuthorizationEvent[]>();
  for (const row of rows) {
    const listingId = (row as EventRow & { listingId?: string }).listingId;
    if (!listingId) continue;
    const list = grouped.get(listingId) ?? [];
    list.push(toEvent(row));
    grouped.set(listingId, list);
  }
  for (const [listingId, list] of grouped) map.set(listingId, foldAuthorizationEvents(list));
  return map;
}

type BindingRow = {
  listingId: string;
  organizationId: string;
  state: string;
  verifiedAt: Date | null;
};

function bindingDelegate(): { findMany: (args: unknown) => Promise<BindingRow[]> } | null {
  const client = prisma as unknown as {
    listingOrgBinding?: { findMany: (args: unknown) => Promise<BindingRow[]> };
  };
  return client.listingOrgBinding ?? null;
}

export async function loadListingBindings(listingIds: string[]): Promise<ListingBinding[]> {
  const bindings = bindingDelegate();
  if (!bindings || listingIds.length === 0) return [];
  const rows = await bindings.findMany({
    where: { listingId: { in: listingIds } },
  });
  return rows.map((row) => ({
    listingId: row.listingId,
    organizationId: row.organizationId,
    state: row.state as ListingBinding['state'],
    verifiedAt: row.verifiedAt ? row.verifiedAt.toISOString() : null,
  }));
}

export async function appendAuthorizationEvent(input: {
  listingId: string;
  kind: AuthorizationEventKind;
  scopes: AuthorizationScope[];
  actorUserId: string;
  evidenceRef: string | null;
  note: string | null;
  expectedHeadSequence: number;
  decisionVersion: number;
  idempotencyKey: string;
}): Promise<{ replay: boolean; sequence: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.schoolAuthorizationEvent.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return { replay: true, sequence: existing.sequence };
      const [rows, instructor, representative] = await Promise.all([
        tx.schoolAuthorizationEvent.findMany({
          where: { listingId: input.listingId },
          orderBy: { sequence: 'asc' },
        }),
        tx.instructor.findUnique({
          where: { id: input.listingId },
          select: { bookingMode: true },
        }),
        tx.listingRepresentativeAuthority.findUnique({
          where: { listingId_userId: { listingId: input.listingId, userId: input.actorUserId } },
        }),
      ]);
      const head = foldAuthorizationEvents(rows.map(toEvent));
      const command: AppendCommand = {
        kind: input.kind,
        scopes: input.scopes,
        actorUserId: input.actorUserId,
        evidenceRef: input.evidenceRef,
        note: input.note,
        expectedHeadSequence: input.expectedHeadSequence,
        decisionVersion: input.decisionVersion,
        idempotencyKey: input.idempotencyKey,
        bookingMode: instructor?.bookingMode,
        representative: representative
          ? {
              userId: representative.userId,
              verifiedAt: representative.verifiedAt.toISOString(),
              evidenceRef: representative.evidenceRef,
            }
          : null,
        existingIdempotencyKey: null,
      };
      const plan = planAuthorizationAppend(head, command);
      if (!plan.ok) throw new AuthorizationCommandError(plan.code);
      if (plan.replay) return { replay: true, sequence: head.headSequence };
      await tx.schoolAuthorizationEvent.create({
        data: {
          listingId: input.listingId,
          sequence: plan.sequence,
          kind: input.kind,
          scopes: plan.scopes,
          actorUserId: input.actorUserId,
          evidenceRef: input.evidenceRef,
          note: input.note,
          decisionVersion: plan.decisionVersion,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.listingAuthzHead.upsert({
        where: { listingId: input.listingId },
        create: {
          listingId: input.listingId,
          headSequence: plan.sequence,
          decisionVersion: plan.decisionVersion,
        },
        update: { headSequence: plan.sequence, decisionVersion: plan.decisionVersion },
      });
      return { replay: false, sequence: plan.sequence };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new AuthorizationCommandError('stale');
    }
    throw error;
  }
}

export function notAuthorizedBody() {
  return { error: { code: 'not_authorized_by_school' as const } };
}
