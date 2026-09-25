// @polsia:user-owned — signed-in instructor manages their own time slots.
//
// `GET /api/instructor-availability` returns all upcoming slots (open +
// booked) for the signed-in instructor's Instructor row. "All upcoming"
// rather than "only open" so the editor can show "this Thursday's 14:00
// slot is taken" instead of a confusing empty list.
//
// `POST /api/instructor-availability` accepts a discriminated input
// (weekly expand vs single add), expands it into N UTC slot rows, and
// returns 201 with the `AvailabilitySlotList` shape. Conflicts surface as
// 409 with `{ errors: { slots: '…' } }`.
//
// Instructor CRUD is gated by `requireAuth`; ownership is resolved via the
// existing pattern `prisma.instructor.findFirst({ where: { email: {
// equals: user.email, mode: 'insensitive' } } })` so a caller-side error
// (signed in but no Instructor row yet) returns an empty list, not a 403
// — the editor can render the empty state without bouncing the user.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { localDateTimeToUtc, providerTimezoneForCity } from '@/lib/business/provider-timezone';
import { AvailabilitySlotCreate, AvailabilitySlotList } from '@/lib/contracts/availability';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function loadOwnedInstructor(user: SessionUser): Promise<OwnedProvider | null | Response> {
  try {
    return await resolveOwnedProvider(user);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json({ errors: { ownership: error.message } }, { status: 409 });
    }
    throw error;
  }
}

// `weekdayInTz` — return the 0-6 Sunday-first weekday of the calendar
// instant represented by `naive` (a Date in epoch ms) when projected into
// `tz`. We only need the weekday number to compare against the operator's
// selection.
function weekdayInTz(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
  }).formatToParts(date);
  const text = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[text] ?? 0;
}

// Returns the local YYYY-MM-DD parts for `date` in `tz`, interpreted as a
// calendar date the operator picked.
function calendarPartsInTz(date: Date, tz: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: string): number => {
    for (const part of parts) {
      if (part.type === type) return Number(part.value);
    }
    return 0;
  };
  return { year: pick('year'), month: pick('month'), day: pick('day') };
}

type ExpandedSlot = {
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
};

// Expand `weeksAhead × weekdays` from `startDate + timeOfDay` in the
// instructor's timezone. We walk day-by-day (one calendar day at a time in
// tz) so DST transitions don't nudge the wall-clock anchor — Intl resolves
// the offset for each individual day.
function expandWeekly(input: {
  weekdays: number[];
  startDate: string;
  timeOfDay: string;
  weeksAhead: number;
  durationMinutes: number;
  tz: string;
}): ExpandedSlot[] {
  const timeOfDayParts = input.timeOfDay.split(':');
  const hh = Number(timeOfDayParts[0] ?? '0');
  const mm = Number(timeOfDayParts[1] ?? '0');
  const startDateParts = input.startDate.split('-');
  const y = Number(startDateParts[0] ?? '0');
  const mo = Number(startDateParts[1] ?? '0');
  const d = Number(startDateParts[2] ?? '0');
  if (![hh, mm, y, mo, d].every(Number.isFinite)) {
    return [];
  }
  // Anchor at noon UTC of startDate so DST can't shift us into the
  // previous calendar day during the boundary walk. Calendar weekday
  // comparisons happen in `tz`.
  const anchorUtc = Date.UTC(y, mo - 1, d, 12, 0);

  const wanted = new Set(input.weekdays);
  const out: ExpandedSlot[] = [];
  const totalDays = input.weeksAhead * 7;
  for (let dayOffset = 0; dayOffset < totalDays; dayOffset += 1) {
    const candidate = new Date(anchorUtc + dayOffset * 24 * 60 * 60 * 1000);
    if (!wanted.has(weekdayInTz(candidate, input.tz))) {
      continue;
    }
    const cp = calendarPartsInTz(candidate, input.tz);
    const startsAt = localDateTimeToUtc(
      `${String(cp.year).padStart(4, '0')}-${String(cp.month).padStart(2, '0')}-${String(cp.day).padStart(2, '0')}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`,
      input.tz,
    );
    if (!startsAt) continue;
    const endsAt = new Date(startsAt.getTime() + input.durationMinutes * 60 * 1000);
    out.push({ startsAt, endsAt, durationMinutes: input.durationMinutes });
  }
  return out;
}

function expandSingle(input: {
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
}): ExpandedSlot {
  const startsAt = new Date(input.startsAt);
  const endsAt = new Date(input.endsAt);
  return {
    startsAt,
    endsAt,
    durationMinutes: input.durationMinutes,
  };
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const owned = await loadOwnedInstructor(user);
  if (owned instanceof Response) return owned;
  if (!owned) {
    // Signed in but no instructor row — render the empty editor state on
    // the client. Returning an empty list (200) is friendlier than 404
    // because the dashboard can branch on "no row yet" vs "no slots yet"
    // without forcing a redirect.
    return NextResponse.json(AvailabilitySlotList.parse({ items: [] }));
  }

  const rows = await prisma.availabilitySlot.findMany({
    where: {
      instructorId: owned.id,
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      instructorId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      bookedAt: true,
    },
  });

  return NextResponse.json(
    AvailabilitySlotList.parse({
      items: rows.map((row) => ({
        id: row.id,
        instructorId: row.instructorId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        durationMinutes: row.durationMinutes,
        bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
        providerRole: owned.providerRole,
        timezone: providerTimezoneForCity(owned.city),
      })),
    }),
  );
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = AvailabilitySlotCreate.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) {
        errors[field] = message;
      }
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = parsed.data;

  const owned = await loadOwnedInstructor(user);
  if (owned instanceof Response) return owned;
  if (!owned) {
    return NextResponse.json(
      { errors: { slots: 'You must complete instructor onboarding first.' } },
      { status: 403 },
    );
  }

  let expansions: ExpandedSlot[];
  if (data.mode === 'weekly') {
    if (
      !data.weekdays ||
      data.weekdays.length === 0 ||
      !data.startDate ||
      !data.timeOfDay ||
      data.weeksAhead === undefined
    ) {
      return NextResponse.json(
        {
          errors: { slots: 'Weekly mode requires weekdays, startDate, timeOfDay and weeksAhead.' },
        },
        { status: 400 },
      );
    }
    expansions = expandWeekly({
      weekdays: data.weekdays,
      startDate: data.startDate,
      timeOfDay: data.timeOfDay,
      weeksAhead: data.weeksAhead,
      durationMinutes: data.durationMinutes,
      tz: providerTimezoneForCity(owned.city),
    });
  } else {
    if (!data.startsAt || !data.endsAt) {
      return NextResponse.json(
        { errors: { slots: 'Single mode requires startsAt and endsAt.' } },
        { status: 400 },
      );
    }
    expansions = [
      expandSingle({
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        durationMinutes: data.durationMinutes,
      }),
    ];
  }

  // Server-side past-date guard. Silently drop any expansion whose
  // startsAt is in the past — the operator might generate a series that
  // includes today's date and we want to skip the past days without
  // failing the whole request.
  const now = new Date();
  const futureExpansions = expansions.filter(
    ({ startsAt, endsAt }) =>
      startsAt.getTime() > now.getTime() &&
      endsAt.getTime() > startsAt.getTime() &&
      endsAt.getTime() - startsAt.getTime() === data.durationMinutes * 60_000,
  );

  if (futureExpansions.length === 0) {
    return NextResponse.json(
      { errors: { slots: 'All of those times are in the past.' } },
      { status: 400 },
    );
  }

  // Server-side conflict guard. Pull the existing slots in the expanded
  // window up front, then skip the explicit conflict to return a 409 with
  // a single, actionable error for the editor's toast. The unique index
  // is the last-resort trap.
  const minStart = futureExpansions.reduce(
    (min, { startsAt }) => (startsAt < min ? startsAt : min),
    futureExpansions[0]?.startsAt ?? now,
  );
  const existing = await prisma.availabilitySlot.findMany({
    where: {
      instructorId: owned.id,
      startsAt: {
        lt: futureExpansions.reduce(
          (max, item) => (item.endsAt > max ? item.endsAt : max),
          futureExpansions[0]?.endsAt ?? now,
        ),
      },
      endsAt: { gt: minStart },
    },
    select: { startsAt: true, endsAt: true },
  });
  const overlaps = (candidate: ExpandedSlot, other: { startsAt: Date; endsAt: Date }) =>
    candidate.startsAt < other.endsAt && candidate.endsAt > other.startsAt;
  const clean = futureExpansions.filter(
    (candidate, index) =>
      !existing.some((row) => overlaps(candidate, row)) &&
      !futureExpansions.slice(0, index).some((other) => overlaps(candidate, other)),
  );

  if (clean.length === 0) {
    return NextResponse.json(
      { errors: { slots: 'All of those times clash with existing slots.' } },
      { status: 409 },
    );
  }

  // Insert one-by-one. If a racing insert snuck in between the read and
  // our writes, the @@unique([instructorId, startsAt]) constraint raises
  // P2002 — surface that as a 409 the same way.
  const insertedIds: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      for (const slot of clean) {
        const created = await tx.availabilitySlot.create({
          data: {
            instructorId: owned.id,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            durationMinutes: slot.durationMinutes,
          },
          select: { id: true },
        });
        insertedIds.push(created.id);
      }
    });
  } catch (err: unknown) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002' || code === 'P2034') {
      return NextResponse.json(
        { errors: { slots: 'One of those times clashes with an existing slot.' } },
        { status: 409 },
      );
    }
    throw err;
  }

  // Refetch the inserted rows (in the same shape the editor renders) so
  // the client can splice them into its list without a separate GET round
  // trip if it wants.
  const inserted = await prisma.availabilitySlot.findMany({
    where: { id: { in: insertedIds } },
    orderBy: { startsAt: 'asc' },
    select: {
      id: true,
      instructorId: true,
      startsAt: true,
      endsAt: true,
      durationMinutes: true,
      bookedAt: true,
    },
  });

  return NextResponse.json(
    AvailabilitySlotList.parse({
      items: inserted.map((row) => ({
        id: row.id,
        instructorId: row.instructorId,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        durationMinutes: row.durationMinutes,
        bookedAt: row.bookedAt ? row.bookedAt.toISOString() : null,
        providerRole: owned.providerRole,
        timezone: providerTimezoneForCity(owned.city),
      })),
    }),
    { status: 201 },
  );
}
