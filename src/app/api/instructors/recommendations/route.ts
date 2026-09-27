//
// Returns an AI-ranked list of instructors for the signed-in student,
// based on the student's most recent `Booking`'s (category, instructor's
// city, preferredAt). If the student has no bookings the route returns
// `{ items: [] }` so the dashboard island treats the section as hidden.
//
// The route:
//   1. requireAuth → 401 if no session.
//   2. Look up UserProfile.role → 403 if not STUDENT.
//   3. Pull the student's most-relevant Booking:
//        - prefer an UPCOMING row (preferredAt >= now) ordered ASC,
//        - else fall back to the most recent past row ordered DESC.
//   4. Compute the candidate set: `Instructor` rows whose
//      `categories` array contains the booking's category AND that have
//      at least one upcoming open `AvailabilitySlot`. Capped at 50
//      schools so the LLM prompt stays compact.
//   5. Hand those to `generateObject` for LLM ranking against the
//      (category, city, preferredAt) anchor; coerce the response into
//      bounds and drop any id not in our candidate set.
//   6. On any AI failure / parsing error, fall back to a deterministic
//      ranker (city match → booked hours) so the page is never blank.
//
// Card-only PII payload — `Instructor.email` is intentionally NOT
// selected here (same rule as `PUBLIC_INSTRUCTOR_SELECT`).
import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateObject } from '@/lib/ai/client';
import {
  genericRecommendationReason,
  type MarketplaceLocale,
  normalizeMarketplaceLocale,
  recommendationReason,
} from '@/lib/business/marketplace-localization';
import {
  InstructorRecommendations,
  RecommendationScore,
} from '@/lib/contracts/instructor-recommendations';
import { prisma } from '@/lib/db';
import { resolveLocale } from '@/lib/i18n';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const MAX_CANDIDATES = 50;
const TOP_N = 5;

// Source the "selected category / city / availability anchor" from the
// student's most relevant Booking. Upcoming rows sort first (encourages
// the matcher to widen its window to ±7 days of the booking time), and
// when no upcoming row exists we fall back to the most recent past
// booking so the section still renders for returning learners.
async function loadLearningAnchor(user: SessionUser): Promise<{
  category: string;
  city: string;
  preferredAt: Date;
} | null> {
  const email = user.email.trim().toLowerCase();
  const now = new Date();
  const upcoming = await prisma.booking.findFirst({
    where: {
      studentEmail: { equals: email, mode: 'insensitive' },
      preferredAt: { gte: now },
    },
    orderBy: { preferredAt: 'asc' },
    select: { category: true, preferredAt: true, instructorId: true },
  });
  const anchor = upcoming
    ? upcoming
    : await prisma.booking.findFirst({
        where: { studentEmail: { equals: email, mode: 'insensitive' } },
        orderBy: { preferredAt: 'desc' },
        select: { category: true, preferredAt: true, instructorId: true },
      });
  if (!anchor) return null;

  // The city anchor comes from the instructor the learner previously
  // (or just) booked with — extracting it from the Booking itself means
  // we don't need a UserProfile.city column or a separate "preferences"
  // capture.
  const instructor = await prisma.instructor.findUnique({
    where: { id: anchor.instructorId },
    select: { city: true },
  });
  if (!instructor) return null;

  return {
    category: anchor.category,
    city: instructor.city,
    preferredAt: anchor.preferredAt,
  };
}

// Narrow candidate list: instructors certified for the category that
// ALSO have at least one upcoming open slot. Returns the rich fields
// needed by the AI prompt PLUS the deterministic fallback AND the
// client-side render — every consumer reads from the same shape so a
// future select drift is caught at one site. `nextSlotAt` is `Date`
// (not `Date | null`) because the function filters out rows without an
// open slot — every returned candidate HAS an upcoming open slot.
type Candidate = {
  id: string;
  name: string;
  city: string;
  categories: string[];
  hourlyRateSek: number;
  photoUrl: string;
  bookedHours: number;
  englishSpeaking: boolean;
  nextSlotAt: Date;
};

async function loadCandidates(category: string): Promise<Candidate[]> {
  const matching = await prisma.instructor.findMany({
    where: { categories: { has: category } },
    select: {
      id: true,
      name: true,
      city: true,
      categories: true,
      hourlyRateSek: true,
      photoUrl: true,
      bookedHours: true,
      englishSpeaking: true,
    },
    take: MAX_CANDIDATES,
    orderBy: [{ city: 'asc' }, { name: 'asc' }],
  });

  if (matching.length === 0) return [];

  // Slot projection from AvailabilitySlot — earliest open slot per
  // instructor (bookedAt IS NULL && startsAt > now). Empty map filters
  // the candidate list down to "available" rows.
  const ids = matching.map((r) => r.id);
  const upcoming = await prisma.availabilitySlot.findMany({
    where: {
      instructorId: { in: ids },
      bookedAt: null,
      startsAt: { gt: new Date() },
    },
    orderBy: { startsAt: 'asc' },
    select: { instructorId: true, startsAt: true },
  });
  const nextSlotByInstructor = new Map<string, Date>();
  for (const row of upcoming) {
    if (!nextSlotByInstructor.has(row.instructorId)) {
      nextSlotByInstructor.set(row.instructorId, row.startsAt);
    }
  }

  return matching
    .map((row): Candidate | null => {
      const slot = nextSlotByInstructor.get(row.id);
      if (!slot) return null;
      return { ...row, nextSlotAt: slot };
    })
    .filter((c): c is Candidate => c !== null);
}

// Build the LLM-friendly compact object: shrink Participant fields to
// what informs the ranking decision, leave the rich fields back on the
// server. Any field the assistent doesn't see is a field the assistant
// cannot hallucinate as the basis for an answer.
type Compact = {
  id: string;
  name: string;
  city: string;
  categories: string[];
  hourlyRateSek: number;
  bookedHours: number;
  englishSpeaking: boolean;
  nextSlotAt: string;
  cityMatchesLearner: boolean;
};

function compactFor(c: Candidate, learnerCity: string): Compact {
  return {
    id: c.id,
    name: c.name,
    city: c.city,
    categories: c.categories,
    hourlyRateSek: c.hourlyRateSek,
    bookedHours: c.bookedHours,
    englishSpeaking: c.englishSpeaking,
    nextSlotAt: c.nextSlotAt.toISOString(),
    cityMatchesLearner: c.city === learnerCity,
  };
}

// Shape we ask the LLM to return. Validated with `safeParse` so a
// stricter model that returns extra keys doesn't crash the contract
// — we just drop what we don't need.
const AiResponseShape = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      score: RecommendationScore.shape.score,
      reason: RecommendationScore.shape.reason,
    }),
  ),
});

async function aiRankCandidates(
  candidates: Candidate[],
  learnerCity: string,
  category: string,
  preferredAt: Date,
  locale: MarketplaceLocale,
): Promise<Map<string, { score: number; reason: string }> | null> {
  const system = [
    'You rank driving instructors for a learner who already booked with one of them.',
    `Selected category: ${category}.`,
    `Selected city: ${learnerCity}.`,
    `Selected availability anchor: ${preferredAt.toISOString()} (interpret +/- 7 days as the matching window).`,
    'You will receive a JSON array of candidate instructors. Return a JSON object with one key "items".',
    'For every item return an object: { id (string, exactly one of the supplied ids), score (0..1), reason (one short sentence) }.',
    'Rank the supplied ids. NEVER invent new ids — drop ids that do not match.',
    'Favour instructors whose city matches the learner city AND who have a slot near the anchor window.',
    'Lower or exclude candidates whose city does not match (unless their other attributes compensate).',
    'Keep reasons under 180 characters and grounded in the candidate fields only.',
    `Write every reason in ${locale === 'sv' ? 'Swedish' : 'English'}; do not mix languages.`,
  ].join('\n');
  const user = JSON.stringify(candidates.map((c) => compactFor(c, learnerCity)));
  try {
    const parsed = await generateObject<unknown>({
      task: 'instructor-ranking',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    const safe = AiResponseShape.safeParse(parsed);
    if (!safe.success) return null;
    const validIds = new Set(candidates.map((c) => c.id));
    const out = new Map<string, { score: number; reason: string }>();
    for (const item of safe.data.items) {
      if (!validIds.has(item.id)) continue;
      // Clamp score into [0, 1] defensively — a model that emits a
      // bounded value works fine without normalisation, but a longer
      // response should not flow raw into the UI.
      const clamped = Math.max(0, Math.min(1, item.score));
      const reason = item.reason.slice(0, 180);
      out.set(item.id, { score: clamped, reason });
    }
    return out;
  } catch {
    return null;
  }
}

// Deterministic fallback (also the secondary sort key when the AI
// returns): prefer city match, then booked hours; map to a score in
// [0, 1] so the UI can render a progress bar without plumbing a
// separate signal.
function deterministicRank(
  candidates: Candidate[],
  learnerCity: string,
  locale: MarketplaceLocale,
): Map<string, { score: number; reason: string }> {
  const out = new Map<string, { score: number; reason: string }>();
  for (const c of candidates) {
    const cityMatches = c.city === learnerCity;
    const bookedHours = c.bookedHours;
    // Heuristic: full credit when the city matches, three-quarters
    // otherwise; small bump for tenure signal.
    const base = cityMatches ? 0.85 : 0.6;
    const tenureBump = Math.min(0.15, bookedHours / 400);
    const score = Math.max(0, Math.min(1, base + tenureBump));
    const reason = recommendationReason({
      city: c.city,
      learnerCity,
      bookedHours,
      locale,
    });
    out.set(c.id, { score, reason });
  }
  return out;
}

function reasonFor(
  id: string,
  ai: Map<string, { score: number; reason: string }> | null,
  fallback: Map<string, { score: number; reason: string }>,
  locale: MarketplaceLocale,
): { score: number; reason: string } {
  const fromAi = ai?.get(id);
  if (fromAi) return fromAi;
  const det = fallback.get(id);
  // `fallback` is computed from the same candidate list, so every id is
  // present. Defensive fallback keeps a typo from silently shipping.
  return det ?? { score: 0.5, reason: genericRecommendationReason(locale) };
}

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  // Require STUDENT role — instructors/handledare are out of scope for
  // the dashboard "Recommended instructors" block. Use the same `.json`
  // envelope the other role-gated routes use.
  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (!profile || profile.role !== 'STUDENT') {
    return NextResponse.json({ errors: { role: 'student_only' } }, { status: 403 });
  }

  const locale = normalizeMarketplaceLocale(await resolveLocale());

  const anchor = await loadLearningAnchor(user);
  if (!anchor) {
    return NextResponse.json(InstructorRecommendations.parse({ items: [] }));
  }

  const candidates = await loadCandidates(anchor.category);
  if (candidates.length === 0) {
    return NextResponse.json(InstructorRecommendations.parse({ items: [] }));
  }

  const fallback = deterministicRank(candidates, anchor.city, locale);
  const ai = await aiRankCandidates(
    candidates,
    anchor.city,
    anchor.category,
    anchor.preferredAt,
    locale,
  );

  const ranked = candidates
    .map((c) => ({ c, ...reasonFor(c.id, ai, fallback, locale) }))
    .sort((a, b) => {
      // Primary: AI/deterministic score, descending.
      if (b.score !== a.score) return b.score - a.score;
      // Secondary: city match wins.
      const aCity = a.c.city === anchor.city ? 1 : 0;
      const bCity = b.c.city === anchor.city ? 1 : 0;
      if (bCity !== aCity) return bCity - aCity;
      // Tertiary: bookedHours desc → "more established" heuristic.
      return b.c.bookedHours - a.c.bookedHours;
    })
    .slice(0, TOP_N);

  const payload = InstructorRecommendations.parse({
    items: ranked.map(({ c, score, reason }) => ({
      id: c.id,
      name: c.name,
      city: c.city,
      categories: c.categories,
      hourlyRateSek: c.hourlyRateSek,
      photoUrl: c.photoUrl,
      bookedHours: c.bookedHours,
      englishSpeaking: c.englishSpeaking,
      score,
      reason,
      nextSlotAt: c.nextSlotAt.toISOString(),
    })),
  });

  return NextResponse.json(payload);
}
