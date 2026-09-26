// @polsia:user-owned — GET (filtered) instructor list + POST (self-onboarding).
// The directory page's island calls GET with URL search params; the handler
// parses them through `parseInstructorQuery`, builds a Prisma `where`
// accordingly, and returns the rows plus the distinct, sorted cities the
// directory `<Select>` populates from. POST accepts the public onboarding
// payload from `/instructors/new`, inserts a new instructor row, fires the
// profile-live confirmation mail, and returns the new id. The shape is
// validated by `InstructorCreate`. The new `email` field lands in the
// optional `Instructor.email String?` column and is intentionally kept OUT
// of `PUBLIC_INSTRUCTOR_SELECT` so it never leaks through any public read.
import 'server-only';
import { Prisma } from '@prisma/client';
import { type NextRequest, NextResponse } from 'next/server';
import { registerKnownContact } from '@/lib/business/escrow';
import { haversineKm, resolveInstructorCoords } from '@/lib/business/geo';
import { confirmedPhotoUrl } from '@/lib/business/photo-verification';
import { buildProviderActivationWhere } from '@/lib/business/provider-activation';
import { providerTimezoneForCity } from '@/lib/business/provider-timezone';
import {
  hasCanonicalCategory,
  loadPublicInstructorAggregates,
  toPublicInstructor,
} from '@/lib/business/public-instructor';
import {
  InstructorCreate,
  InstructorCreated,
  InstructorList,
  type InstructorQuery,
  PUBLIC_INSTRUCTOR_SELECT,
  parseInstructorQuery,
} from '@/lib/contracts/instructors';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { instructorProfileLiveEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = parseInstructorQuery(req.nextUrl.searchParams);
  if (!parsed.ok) {
    // Same envelope the form's `applyServerErrors` consumes.
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const q = parsed.value;

  // `countOnly=1` short-circuits into a single Prisma `count()` and skips the
  // full row hydrate / slot projection. Used by the contact page's instructor-
  // browsing CTA cluster to render a live "{count} instructors" line without
  // paying for the full directory fetch every page load.
  const countOnly = req.nextUrl.searchParams.get('countOnly') === '1';
  const hasDirectoryFilters =
    q.categories !== undefined ||
    q.city !== undefined ||
    q.minRate !== undefined ||
    q.maxRate !== undefined ||
    q.minRating !== undefined ||
    q.availability !== undefined ||
    q.english !== undefined ||
    q.lat !== undefined ||
    q.lng !== undefined ||
    q.nearKm !== undefined ||
    q.sort !== undefined ||
    q.providerRole !== undefined;
  if (countOnly && !hasDirectoryFilters) {
    const count = await prisma.instructor.count({
      where: buildProviderActivationWhere(),
    });
    return NextResponse.json(InstructorList.parse({ items: [], cities: [], count }));
  }
  // Only branch into the geo path when the visitor supplied BOTH valid lat
  // and lng — half-paired inputs are treated as "no geo preference" so the
  // urban case (city filter still works) stays the default fallback.
  const hasGeo = q.lat != null && q.lng != null;
  const userLat = q.lat;
  const userLng = q.lng;
  const nearKm = q.nearKm;

  // Prisma can't sort by a derived haversine distance, so when the caller
  // asks for `sort=distance` we drop the Prisma-level orderBy and re-sort
  // in app code by the computed `distanceKm`. Otherwise we let Prisma do
  // it (city, then name) so the path where geo is unused stays a single
  // indexed read.
  const rawRows = await prisma.instructor.findMany({
    where: buildWhere(q),
    select: PUBLIC_INSTRUCTOR_SELECT,
    orderBy:
      q.sort === 'distance' && hasGeo
        ? undefined
        : [{ city: 'asc' as const }, { name: 'asc' as const }],
  });
  const canonicalRows = rawRows.filter(hasCanonicalCategory);

  // Compute distance for every kept row whose coordinates resolve. Run before
  // the slot projection so the (lat/lng + nearKm) prune keeps the slot
  // query's `instructorId: { in: [...] }` array as small as possible. Rows
  // without resolvable coordinates stay on the page when there's no
  // `nearKm` filter (distant fallback via city lookup) but are dropped
  // once `nearKm` is set — a row whose distance we can't answer can't pass
  // a "within X km" gate.
  const rowsWithDistance = canonicalRows.map((row) => {
    if (!hasGeo || userLat == null || userLng == null) {
      return { row, distanceKm: undefined as number | undefined };
    }
    const coords = resolveInstructorCoords(row);
    if (!coords) return { row, distanceKm: undefined };
    return {
      row,
      distanceKm: haversineKm(userLat, userLng, coords.latitude, coords.longitude),
    };
  });
  const prunedRows =
    hasGeo && nearKm != null
      ? rowsWithDistance.filter(
          (r): r is { row: typeof r.row; distanceKm: number } =>
            r.distanceKm != null && r.distanceKm <= nearKm,
        )
      : rowsWithDistance;

  if (q.sort === 'distance' && hasGeo) {
    // Unresolved-distance rows sort to the end so the city-keyed fallback
    // never hides behind "no data"; we already pruned them out above when
    // `nearKm` was set, so a "nearest" sort + `nearKm` filter is the strict
    // mode the user gets clarity on the order of every row on screen.
    const fallback =
      nearKm != null ? [] : prunedRows.filter(({ distanceKm }) => distanceKm == null);
    const resolved = prunedRows
      .filter((r): r is { row: typeof r.row; distanceKm: number } => r.distanceKm != null)
      .sort((a, b) => a.distanceKm - b.distanceKm);
    prunedRows.length = 0;
    prunedRows.push(...resolved, ...fallback);
  }

  // Load review aggregates once for the candidate rows. A minimum-rating
  // filter is deliberately applied after the base Prisma read because ratings
  // are validated and averaged by the shared public aggregate loader.
  const aggregates = await loadPublicInstructorAggregates(
    canonicalRows.map((row) => ({ id: row.id, userId: row.userId })),
  );
  const minRating = q.minRating;
  const ratedRows =
    minRating == null
      ? prunedRows
      : prunedRows.filter(({ row }) => {
          const average = aggregates.get(row.id)?.reviewSummary.averageRating;
          return average != null && average >= minRating;
        });

  // Slot projection runs against the already-pruned and rating-filtered id
  // list so geo/rating searches don't query slots for rows we've eliminated.
  const instructorIds = ratedRows.map(({ row }) => row.id);
  const nextSlotByInstructor = new Map<string, string>();
  let filteredRows = ratedRows;
  const availability = q.availability;
  if (instructorIds.length > 0) {
    const upcoming = await prisma.availabilitySlot.findMany({
      where: {
        instructorId: { in: instructorIds },
        bookedAt: null,
        startsAt: { gt: new Date() },
      },
      orderBy: { startsAt: 'asc' },
      select: { instructorId: true, startsAt: true },
    });

    const rowById = new Map(ratedRows.map(({ row }) => [row.id, row]));
    const matchingSlots = availability
      ? upcoming.filter((slot) => {
          const instructor = rowById.get(slot.instructorId);
          return (
            instructor != null && matchesAvailability(slot.startsAt, instructor.city, availability)
          );
        })
      : upcoming;

    if (availability) {
      const availableIds = new Set(matchingSlots.map((slot) => slot.instructorId));
      filteredRows = ratedRows.filter(({ row }) => availableIds.has(row.id));
    }

    for (const row of matchingSlots) {
      if (!nextSlotByInstructor.has(row.instructorId)) {
        nextSlotByInstructor.set(row.instructorId, row.startsAt.toISOString());
      }
    }
  }

  const items = filteredRows.map(({ row, distanceKm }) =>
    toPublicInstructor(
      row,
      aggregates.get(row.id) ?? {
        verificationStatus: 'unverified',
        reviewSummary: { count: 0, averageRating: null },
      },
      nextSlotByInstructor.get(row.id) ?? null,
      distanceKm,
    ),
  );

  const cities = Array.from(new Set(canonicalRows.map((r) => r.city))).sort();

  // We DO return the `englishSpeaking` flag on each row — the directory island
  // surfaces it in the filter toggle (and could surface it as a badge later).
  // The contract's `InstructorList.parse` enforces that and re-introduces a
  // runtime check that catches any future select drift.
  return NextResponse.json(
    InstructorList.parse({ items, cities, ...(countOnly ? { count: items.length } : {}) }),
  );
}

export async function POST(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  // Marketplace listings are authorised driving schools only. Handledare
  // accounts use the guidance surfaces, not public school inventory.
  if (profile?.role !== 'INSTRUCTOR') {
    return NextResponse.json(
      { errors: { role: 'An authorized driving-school account is required.' } },
      { status: 403 },
    );
  }

  const license = await prisma.instructorLicense.findUnique({
    where: { userId: user.id },
    select: { status: true },
  });
  if (license?.status !== 'VERIFIED') {
    return NextResponse.json(
      {
        errors: {
          license:
            'Transportstyrelsen credentials must be verified before publishing a school listing.',
        },
      },
      { status: 403 },
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Ogiltig JSON' } }, { status: 400 });
  }

  const parsed = InstructorCreate.safeParse(bodyJson);
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

  const { name, city, categories, hourlyRateSek, bio, serviceArea, email, locale } = parsed.data;

  // Schema declares `id @id` with NO `@default`, so we mint the id here.
  // `crypto.randomUUID()` is collision-resistant enough that P2002 is
  // effectively never hit; if it ever is, the friendly 409 lets the client
  // re-submit without surfacing a stack trace.
  const id = crypto.randomUUID();

  // Pair the new marketplace listing with the authenticated account. The
  // provider role is derived from UserProfile rather than trusted from JSON.
  //
  // The DB column is NOT `@unique` (Prisma refuses to add a UNIQUE via
  // `prisma db push` without `--accept-data-loss`, which the deploy gate does
  // not pass). So the "one listing per user" invariant is enforced HERE: if
  // this user already has an instructor row, we don't attach `userId` to the
  // new row — the fresh row still gets created (marketplace behaviour
  // preserved) but only the first row per user receives the FK.
  const userId = user.id;
  // Phase 1 supply is authorised schools only — never stamp HANDLEDARE here.
  const requestedRole = 'INSTRUCTOR' as const;
  const existing = await prisma.instructor.findMany({
    where: { userId },
  });
  if (existing.length > 1) {
    return NextResponse.json(
      { errors: { form: 'Provider ownership needs operator review.' } },
      { status: 409 },
    );
  }
  if (existing[0]) {
    const existingRole = existing[0].providerRole === 'HANDLEDARE' ? 'HANDLEDARE' : 'INSTRUCTOR';
    if (existingRole !== requestedRole) {
      return NextResponse.json(
        { errors: { providerRole: 'This account already has another provider profile.' } },
        { status: 409 },
      );
    }
    return NextResponse.json(InstructorCreated.parse({ id: existing[0].id, emailSent: false }), {
      status: 200,
    });
  }
  const confirmedImageUrl = await confirmedPhotoUrl(user.id);
  if (!confirmedImageUrl) {
    return NextResponse.json(
      { errors: { photoUrl: 'A confirmed profile photo is required before publishing.' } },
      { status: 409 },
    );
  }
  const legacyRows = await prisma.instructor.findMany({
    where: { email: { equals: email.trim().toLowerCase(), mode: 'insensitive' }, userId: null },
    orderBy: { id: 'asc' },
  });
  if (legacyRows.length > 1) {
    return NextResponse.json(
      { errors: { form: 'Provider ownership needs operator review.' } },
      { status: 409 },
    );
  }
  if (legacyRows[0]) {
    const claimed = await prisma.instructor.update({
      where: { id: legacyRows[0].id },
      data: { userId, providerRole: requestedRole },
    });
    return NextResponse.json(InstructorCreated.parse({ id: claimed.id, emailSent: false }), {
      status: 200,
    });
  }
  try {
    const created = await prisma.instructor.create({
      data: {
        id,
        name,
        city,
        ...(serviceArea ? { serviceArea } : {}),
        categories,
        hourlyRateSek,
        bio,
        photoUrl: confirmedImageUrl,
        email,
        userId,
        providerRole: requestedRole,
      },
    });

    // Register before sending so this transactional email is treated as a
    // known-contact message. Neither side effect can roll back the created
    // profile; the response tells the client whether delivery succeeded.
    const sessionEmail = email.trim().toLowerCase();
    const profileUrl = `${env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/instructors/${created.id}`;

    await registerKnownContact({
      email: sessionEmail,
      name: created.name,
      source: 'signup',
    });

    const emailResults = await Promise.allSettled([
      sendEmail({
        to: sessionEmail,
        ...instructorProfileLiveEmail({
          name: created.name,
          profileUrl,
          imageUrl: created.photoUrl,
          locale: locale === 'en' ? 'en' : 'sv',
        }),
      }),
    ]);
    const emailSent = emailResults[0]?.status === 'fulfilled';

    return NextResponse.json(InstructorCreated.parse({ id: created.id, emailSent }), {
      status: 201,
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ errors: { form: 'Försök igen' } }, { status: 409 });
    }
    throw err;
  }
}

function buildWhere(q: InstructorQuery): Prisma.InstructorWhereInput {
  const filters: Prisma.InstructorWhereInput = {};
  if (q.categories && q.categories.length > 0) {
    // Postgres `String[]` exposes per-value `has` (single); the canonical
    // "any-of" idiom is `OR` of `has`. No-op when the array is empty.
    filters.OR = q.categories.map((code) => ({ categories: { has: code } }));
  }
  if (q.city) filters.city = q.city;
  if (typeof q.minRate === 'number' || typeof q.maxRate === 'number') {
    filters.hourlyRateSek = {
      ...(typeof q.minRate === 'number' ? { gte: q.minRate } : {}),
      ...(typeof q.maxRate === 'number' ? { lte: q.maxRate } : {}),
    };
  }
  // Distinguish "filter unset" from "filter=true" so a visitor who hasn't
  // touched the toggle still sees every row.
  if (q.english === true) filters.englishSpeaking = true;
  else if (q.english === false) filters.englishSpeaking = false;
  // Public directory is school-only. Ignore client requests for HANDLEDARE
  // marketplace supply — that path is guidance-only, not bookable listings.
  if (q.providerRole === 'INSTRUCTOR') filters.providerRole = 'INSTRUCTOR';

  return {
    AND: [buildProviderActivationWhere(), filters],
  };
}

function matchesAvailability(
  startsAt: Date,
  city: string,
  availability: NonNullable<InstructorQuery['availability']>,
): boolean {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: providerTimezoneForCity(city),
    weekday: 'short',
  }).format(startsAt);
  const isWeekend = weekday === 'Sat' || weekday === 'Sun';
  return availability === 'weekend' ? isWeekend : !isWeekend;
}
