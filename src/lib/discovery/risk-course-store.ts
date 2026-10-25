import type { TeachingPermissionFact } from '@/lib/acquisition/category-offering-policy';
import { prisma } from '@/lib/db';
import {
  consumesSeat,
  isRiskCoursesOn,
  isSessionDiscoverable,
  municipalitySlug,
  type RiskCourseType,
  remainingSeats,
  riskCourseAcceptDecision,
  riskCoursePublishDecision,
  riskCourseRequestDecision,
  seatDisplayIsHold,
} from '@/lib/discovery/risk-course-policy';
import {
  canAcceptPendingRequest,
  type FoldedAuthorization,
  foldAuthorizationEvents,
  isSchoolAuthzEnforcementOn,
} from '@/lib/orgs/school-authorization-policy';

type SessionRow = {
  id: string;
  listingId: string;
  courseType: string;
  licenceCategory: string;
  municipality: string;
  location: string;
  startsAt: Date;
  endsAt: Date;
  seatCapacity: number;
  priceSek: number;
  publishedAt: Date | null;
  approvedAt: Date | null;
  source: string;
  listing?: { name: string; bookingMode: string | null };
  requests?: Array<{ status: string; commitmentRoute: string | null }>;
};

function db() {
  return prisma as unknown as {
    riskCourseSession?: {
      findMany: (args: unknown) => Promise<SessionRow[]>;
      findFirst: (args: unknown) => Promise<SessionRow | null>;
      create: (args: unknown) => Promise<SessionRow>;
    };
    riskCourseRequest?: {
      create: (args: unknown) => Promise<{ id: string; status: string }>;
      findFirst: (args: unknown) => Promise<{
        id: string;
        status: string;
        sessionId: string;
        listingId: string;
      } | null>;
      update: (args: unknown) => Promise<{ id: string; status: string }>;
    };
    teachingPermission?: {
      findMany: (args: unknown) => Promise<(TeachingPermissionFact & { listingId: string })[]>;
    };
    schoolAuthorizationEvent?: {
      findMany: (args: unknown) => Promise<
        Array<{
          sequence: number;
          kind: string;
          scopes: string[];
          decisionVersion: number;
          actorUserId: string;
          evidenceRef: string | null;
          note: string | null;
          idempotencyKey: string;
          createdAt: Date;
        }>
      >;
    };
  };
}

async function foldedFor(listingId: string): Promise<FoldedAuthorization> {
  const events = db().schoolAuthorizationEvent;
  if (!events) return foldAuthorizationEvents([]);
  const rows = await events.findMany({
    where: { listingId },
    orderBy: { sequence: 'asc' },
  });
  return foldAuthorizationEvents(
    rows.map((row) => ({
      sequence: row.sequence,
      kind: row.kind as 'grant' | 'withdraw' | 'admin_suspend',
      scopes: row.scopes,
      decisionVersion: row.decisionVersion,
      actorUserId: row.actorUserId,
      evidenceRef: row.evidenceRef,
      note: row.note,
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
    })),
  );
}

export async function listDiscoverableRiskSessions(input: {
  courseType: RiskCourseType;
  municipality: string;
  date?: string;
}) {
  if (!isRiskCoursesOn()) return [];
  const table = db().riskCourseSession;
  if (!table) return [];
  const slug = municipalitySlug(input.municipality);
  const rows = await table.findMany({
    where: { courseType: input.courseType, municipality: slug },
    include: { listing: { select: { name: true, bookingMode: true } }, requests: true },
    orderBy: { startsAt: 'asc' },
  });
  return rows
    .filter((row) =>
      isSessionDiscoverable({
        publishedAt: row.publishedAt?.toISOString() ?? null,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        source: row.source,
        startsAt: row.startsAt.toISOString(),
      }),
    )
    .filter((row) => {
      if (!input.date) return true;
      return row.startsAt.toISOString().slice(0, 10) === input.date;
    })
    .map((row) => {
      const confirmed = (row.requests ?? []).filter((request) =>
        consumesSeat({ status: request.status, commitmentRoute: request.commitmentRoute }),
      ).length;
      return {
        id: row.id,
        listingId: row.listingId,
        schoolName: row.listing?.name ?? row.listingId,
        courseType: row.courseType,
        startsAt: row.startsAt.toISOString(),
        location: row.location,
        priceSek: row.priceSek,
        remainingSeats: remainingSeats(row.seatCapacity, confirmed),
        seatIsHold: seatDisplayIsHold(),
        bookingMode: 'request' as const,
      };
    });
}

export async function publishRiskCourseSession(input: {
  listingId: string;
  courseType: string;
  licenceCategory: string;
  municipality: string;
  location: string;
  startsAt: string;
  endsAt: string;
  seatCapacity: number;
  priceSek: number;
  source: 'SCHOOL_PUBLISHED' | 'ACQ_DRAFT';
  schoolApproved: boolean;
  listingLegalEntity: string;
  listingLocation: string;
}) {
  if (!isRiskCoursesOn()) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const permissions = db().teachingPermission
    ? await db().teachingPermission.findMany({
        where: { listingId: input.listingId, status: 'CURRENT' },
      })
    : [];
  const decision = riskCoursePublishDecision({
    courseType: input.courseType,
    licenceCategory: input.licenceCategory,
    permissions,
    listingLegalEntity: input.listingLegalEntity,
    listingLocation: input.listingLocation,
    source: input.source,
    schoolApproved: input.schoolApproved,
  });
  if (!decision.allowed) return { status: 403 as const, body: { error: { code: decision.code } } };
  const table = db().riskCourseSession;
  if (!table) return { status: 503 as const, body: { error: { code: 'not_available' } } };
  const now = input.source === 'SCHOOL_PUBLISHED' || input.schoolApproved ? new Date() : null;
  const row = await table.create({
    data: {
      listingId: input.listingId,
      courseType: input.courseType,
      licenceCategory: input.licenceCategory,
      municipality: municipalitySlug(input.municipality),
      location: input.location,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      seatCapacity: input.seatCapacity,
      priceSek: input.priceSek,
      source: input.source,
      publishedAt: input.source === 'SCHOOL_PUBLISHED' ? now : input.schoolApproved ? now : null,
      approvedAt: input.schoolApproved || input.source === 'SCHOOL_PUBLISHED' ? now : null,
    },
  });
  return { status: 201 as const, body: { id: row.id, published: Boolean(row.publishedAt) } };
}

export async function requestRiskCourseSession(input: {
  sessionId: string;
  studentName: string;
  studentEmail: string;
  studentUserId?: string;
  instant?: boolean;
  hasE4?: boolean;
  studentContactVerified: boolean;
}) {
  if (!isRiskCoursesOn()) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const sessions = db().riskCourseSession;
  const requests = db().riskCourseRequest;
  if (!sessions || !requests)
    return { status: 503 as const, body: { error: { code: 'not_available' } } };
  const session = await sessions.findFirst({
    where: { id: input.sessionId },
    include: { listing: { select: { name: true, bookingMode: true } }, requests: true },
  });
  if (!session) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const folded = await foldedFor(session.listingId);
  const decision = riskCourseRequestDecision({
    discoverable: isSessionDiscoverable({
      publishedAt: session.publishedAt?.toISOString() ?? null,
      approvedAt: session.approvedAt?.toISOString() ?? null,
      source: session.source,
      startsAt: session.startsAt.toISOString(),
    }),
    folded,
    enforcementOn: isSchoolAuthzEnforcementOn(),
    expired: Date.parse(session.startsAt.toISOString()) <= Date.now(),
    categoryAllowed: true,
    studentContactVerified: input.studentContactVerified,
    instant: Boolean(input.instant),
    hasE4: Boolean(input.hasE4),
  });
  if (!decision.allowed) return { status: 403 as const, body: { error: { code: decision.code } } };
  const row = await requests.create({
    data: {
      sessionId: session.id,
      listingId: session.listingId,
      studentUserId: input.studentUserId ?? null,
      studentName: input.studentName,
      studentEmail: input.studentEmail,
      status: decision.mode === 'instant' ? 'confirmed' : 'pending',
      commitmentRoute: decision.mode === 'instant' ? 'native' : null,
    },
  });
  return {
    status: 201 as const,
    body: {
      id: row.id,
      status: row.status,
      mode: decision.mode,
      seatConsumed: consumesSeat({
        status: row.status,
        commitmentRoute: decision.mode === 'instant' ? 'native' : null,
      }),
    },
  };
}

export async function acceptRiskCourseRequest(input: {
  requestId: string;
  commitmentRoute: 'native' | 'allocation' | 'external_manual';
}) {
  if (!isRiskCoursesOn()) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const requests = db().riskCourseRequest;
  const sessions = db().riskCourseSession;
  if (!requests || !sessions)
    return { status: 503 as const, body: { error: { code: 'not_available' } } };
  const existing = await requests.findFirst({ where: { id: input.requestId } });
  if (!existing) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const session = await sessions.findFirst({
    where: { id: existing.sessionId },
    include: { listing: { select: { bookingMode: true } } },
  });
  if (!session) return { status: 404 as const, body: { error: { code: 'not_found' } } };
  const folded = await foldedFor(existing.listingId);
  const decision = riskCourseAcceptDecision({
    bookingMode: session.listing?.bookingMode ?? null,
    folded,
    enforcementOn: isSchoolAuthzEnforcementOn(),
    expired: Date.parse(session.startsAt.toISOString()) <= Date.now(),
  });
  if (!decision.allowed) return { status: 403 as const, body: { error: { code: decision.code } } };
  const row = await requests.update({
    where: { id: existing.id },
    data: { status: 'confirmed', commitmentRoute: input.commitmentRoute },
  });
  void canAcceptPendingRequest;
  return {
    status: 200 as const,
    body: {
      id: row.id,
      status: row.status,
      seatConsumed: consumesSeat({
        status: 'confirmed',
        commitmentRoute: input.commitmentRoute,
      }),
    },
  };
}
