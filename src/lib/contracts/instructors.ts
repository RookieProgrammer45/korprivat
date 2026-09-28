// and server both import this so a single schema is the source of truth for
// the instructor payload returned by GET /api/instructors and
// GET /api/instructors/[id].
//
// Keep this file purely zod (no server-only imports) so the `[id]` detail
// island, the new directory island, and both route handlers can all depend on
// it without leaking server-only modules into client bundles.
import { z } from 'zod';
import { LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import { ProviderRoleEnum } from '@/lib/contracts/availability';

// Inline literal tuple of cancellation tiers. Kept here rather than
// imported from `lib/business/cancellation-policy` because zod's
// `z.enum(T)` infers the narrowed literal union ONLY when `T` is a
// literal tuple (not a `readonly CancellationTier[]` reference); without
// this, the contract schemas stop narrowing `tier` to the three-value
// union and `instructor.cancellationPolicyTier ?? 'flexible'` becomes
// a `string` assignment.
const CANCELLATION_TIERS = ['flexible', 'moderate', 'strict'] as const;

// Booking mode enum — same reason as CANCELLATION_TIERS for keeping
// this as a literal tuple of strings. 'instant' / 'request' drives the
// booking-flow mechanic per the brief.
export const InstructorBookingModeEnum = z.enum(['instant', 'request']);
export type InstructorBookingMode = z.infer<typeof InstructorBookingModeEnum>;

// Public Prisma `select` shape returned by every instructor endpoint. Server
// only — hoisted here so the `[id]` handler and the list route share EXACTLY
// the same field set (catching an omitted field half-of-the-time bug from
// creeping in if they diverged). `email` is intentionally omitted because
// it is server-side PII used only for booking notifications.
export const PUBLIC_INSTRUCTOR_SELECT = {
  id: true,
  name: true,
  city: true,
  serviceArea: true,
  categories: true,
  hourlyRateSek: true,
  bio: true,
  photoUrl: true,
  englishSpeaking: true,
  latitude: true,
  longitude: true,
  // Used only to join the coarse verification status server-side. The
  // response contract strips this internal scalar before serialization.
  userId: true,
  // Cancellation-policy tier the instructor publishes on their profile.
  // Surfaced on the directory card (small badge) and the detail page
  // (full schedule). Nullable on the storage column; the contract is
  // nullable too so the badges read "flexible" by default upstream.
  cancellationPolicyTier: true,
  // Booking mode the instructor publishes on their profile. Drives the
  // "Instant book" vs "Request to book" copy on the directory card and
  // the booking flow on the detail page. Defaulted to 'instant' on the
  // server's read path when missing.
  bookingMode: true,
  providerRole: true,
} as const;

// Read shape: persisted instructor record returned by the detail endpoint.
// `categories` is a free-form `String[]` at the storage layer (categories are
// a small, versioned enum at the business layer — see licence-categories.ts),
// so the contract validates a non-empty list of strings; the route handler
// additionally filters to members of the canonical enum before returning.
//
export const InstructorItem = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  serviceArea: z.string().min(1),
  categories: z.array(z.enum(LICENCE_CATEGORY_CODES)).min(1),
  hourlyRateSek: z.number().int().nonnegative(),
  bio: z.string(),
  photoUrl: z.string(),
  englishSpeaking: z.boolean(),
  languages: z.array(z.enum(['sv', 'en'])).min(1),
  verificationStatus: z.enum(['verified', 'pending', 'rejected', 'unverified']),
  reviewSummary: z.object({
    count: z.number().int().nonnegative(),
    averageRating: z.number().min(0).max(5).nullable(),
  }),
  nextSlotAt: z.string().datetime().nullable(),
  // Cancellation-policy tier published on the instructor's profile.
  // Nullable on the storage column; nullable on the contract too so a
  // pre-tier row reads as `null` and the consuming island falls back to
  // a "Flexible" badge upstream.
  cancellationPolicyTier: z.enum(CANCELLATION_TIERS).nullable(),
  // Booking mode the instructor publishes on their profile. Nullable on
  // the storage column; the read path defaults to 'instant' when
  // missing so legacy pre-mode rows behave like the legacy
  // always-instant flow.
  bookingMode: InstructorBookingModeEnum.nullable(),
  providerRole: ProviderRoleEnum,
  affiliation: z
    .object({
      name: z.string().min(1),
      slug: z.string().min(1),
    })
    .nullable()
    .optional(),
});

// Read shape for list rows: same as detail plus the directory-required
// language flag.
// `nextSlotAt` is the ISO datetime of the instructor's earliest OPEN slot in
// the future (`bookedAt IS NULL && startsAt > now`), projected once per list
// fetch from `AvailabilitySlot`. `nullable()` so an instructor with no
// upcoming availability serialises as `null` (the pill renders nothing for
// `null`); `optional()` so other callers that don't compute it stay valid.
export const InstructorFilteredItem = InstructorItem.extend({
  // Optional — only present when the caller supplied valid `lat` / `lng`
  // params AND the row resolved to coordinates (own columns or city lookup).
  // `z.number().optional()` lets the server `delete row.distanceKm` for
  // unresolvable rows without polluting the response shape.
  distanceKm: z.number().nonnegative().optional(),
});

// List response envelope. `cities` is the distinct set of cities across the
// FILTERED rows the directory page feeds to its `<Select>`. Empty on a filter
// combination that has no matches — the island keeps the FIRST non-empty
// cities list it saw, so an empty `cities` later is fine. `count` is the
// total number of FILTERED rows (mirrors `items.length`) and is the canonical
// value published with the `countOnly=1` short-circuit so the contact page's
// instructor-browsing CTA can render a live pilot-instructor count without
// pulling every row; absent on the full list response.
export const InstructorList = z.object({
  items: z.array(InstructorFilteredItem),
  cities: z.array(z.string()),
  count: z.number().int().nonnegative().optional(),
});

// Parsed, fully-typed filter spec for GET /api/instructors. Coercion happens
// INSIDE the schema so the handler reads a typed object rather than raw
// strings. `categories` is passed through to the canonical enum boundary so
// invalid licence-category values are rejected instead of silently broadening
// a URL. The geo fields
// (`lat`, `lng`, `nearKm`, `sort`) all use `safeParse`-or-`undefined`
// coercion so a tampered URL silently reverts to "no geo filter applied".
export const InstructorQuery = z
  .object({
    categories: z.array(z.enum(LICENCE_CATEGORY_CODES)).optional(),
    city: z.string().min(1).optional(),
    minRate: z.coerce.number().int().positive().optional(),
    maxRate: z.coerce.number().int().positive().optional(),
    minRating: z.coerce
      .number()
      .min(1)
      .max(5)
      .refine((value) => Number.isInteger(value * 2), 'Rating must use half-star increments')
      .optional(),
    availability: z.enum(['weekday', 'weekend']).optional(),
    english: z.boolean().optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    nearKm: z.coerce.number().int().positive().max(20_000).optional(),
    sort: z.enum(['distance', 'default']).optional(),
    providerRole: ProviderRoleEnum.optional(),
    /** Marketplace affiliation filter — school Membership vs independent. */
    affiliation: z.enum(['school', 'independent', 'all']).optional(),
  })
  .superRefine((query, ctx) => {
    if (query.minRate != null && query.maxRate != null && query.minRate > query.maxRate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['minRate'],
        message: 'Minimum rate cannot exceed maximum rate',
      });
    }
  });

// Write shape: instructor self-onboarding form POSTs this to /api/instructors.
// Swedish-language error messages match the operator-approved copy on the
// catchment surface (`/for-instructors`, `/instructors/new`).
export const InstructorCreate = z.object({
  name: z.string().min(1, 'Ange ditt namn').max(120, 'Namnet är för långt'),
  city: z.string().min(1, 'Ange stad').max(80, 'Stadsnamnet är för långt'),
  categories: z
    .array(z.enum(LICENCE_CATEGORY_CODES), {
      message: 'Välj minst en behörighetskategori',
    })
    .min(1, 'Välj minst en behörighetskategori'),
  hourlyRateSek: z
    .number({
      message: 'Ange en timkostnad',
    })
    .int('Timkostnaden måste vara ett heltal')
    .positive('Timkostnaden måste vara större än 0'),
  bio: z.string().min(1, 'Skriv en kort presentation').max(2000, 'Presentationen är för lång'),
  // Optional public catchment description. Empty input is treated as the
  // legacy city-only listing by the route handler.
  serviceArea: z.string().trim().max(160, 'Serviceområdet är för långt').optional(),
  // `photoUrl` is the R2-hosted URL returned by POST /api/instructors/photo;
  // the field is required here only because the form posts the value straight
  // through, but the meaningful guard is the upload route's image/* + ≤20 MB
  // validation. Server-side it lands in the `photoUrl` String column.
  photoUrl: z.string().url('Bilden måste vara en giltig URL (https://…)'),
  // Email is captured at self-onboarding so we can send the profile-live
  // confirmation and any future booking notifications. Required server-side;
  // the `PUBLIC_INSTRUCTOR_SELECT` deliberately keeps it OUT of every public
  // read so it never leaks through /api/instructors or /api/instructors/[id].
  email: z.string().email('Ange en giltig e-postadress'),
  providerRole: ProviderRoleEnum.optional(),
  locale: z.enum(['sv', 'en']).optional(),
});

// Response shape returned by the server after a successful insert. The client
// navigates to `/instructors/[id]` and the existing detail island re-fetches
// the full record via GET /api/instructors/[id], plus whether the best-effort
// profile-live confirmation email was accepted by the email transport.
export const InstructorCreated = z.object({
  id: z.string(),
  emailSent: z.boolean(),
});

// Write shape for PATCH /api/instructors/me — the dashboard editor's
// payload. Right now it ONLY carries `tier` (the cancellation-policy
// tier the instructor publishes on their profile). The route handler
// scopes by the signed-in user's id and is a no-op when the user has
// no linked Instructor row (404 surfaces to the client so the editor
// can prompt them to finish onboarding first).
export const InstructorPolicyUpdateRequest = z.object({
  tier: z.enum(CANCELLATION_TIERS, {
    message: 'Pick one of the three cancellation tiers',
  }),
  // Booking mode the instructor publishes. Optional so legacy clients
  // that only send `tier` continue to PATCH successfully — the route
  // handler applies it when present and ignores it otherwise.
  bookingMode: InstructorBookingModeEnum.optional(),
});
export type InstructorPolicyUpdateRequest = z.infer<typeof InstructorPolicyUpdateRequest>;

// Shared write shape for the dashboard editor. Same shape as the request;
// explicit so a future widening (e.g. allow-list of tier transitions, or a
// reason field) doesn't bleed into the request contract by accident.
export const InstructorPolicyUpdate = InstructorPolicyUpdateRequest;
export type InstructorPolicyUpdate = InstructorPolicyUpdateRequest;

// Response shape returned by PATCH /api/instructors/me. Echoes the saved
// tier (and the resolved instructor id) so the editor can update without
// a separate GET round-trip. Optional `bookingMode` widens the response
// for the parallel booking-mode editor — when the operator edited only
// the cancellation tier, the response still includes both fields.
export const InstructorPolicyUpdated = z.object({
  id: z.string(),
  cancellationPolicyTier: z.enum(CANCELLATION_TIERS).nullable(),
  bookingMode: InstructorBookingModeEnum.nullable(),
});
export type InstructorPolicyUpdated = z.infer<typeof InstructorPolicyUpdated>;

// Response shape for GET /api/instructors/me. Mirrors the schema-required
// instructor fields the editor needs on mount. Email is intentionally
// excluded — it is server-only PII used for booking notifications.
export const InstructorMe = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  hourlyRateSek: z.number().int().nonnegative(),
  cancellationPolicyTier: z.enum(CANCELLATION_TIERS).nullable(),
  bookingMode: InstructorBookingModeEnum.nullable(),
  providerRole: ProviderRoleEnum,
  timezone: z.string().min(1),
  setupComplete: z.boolean(),
  canManageAvailability: z.boolean(),
});
export type InstructorMe = z.infer<typeof InstructorMe>;

export type InstructorItem = z.infer<typeof InstructorItem>;
export type InstructorFilteredItem = z.infer<typeof InstructorFilteredItem>;
export type InstructorList = z.infer<typeof InstructorList>;
export type InstructorQuery = z.infer<typeof InstructorQuery>;
export type InstructorCreate = z.infer<typeof InstructorCreate>;
export type InstructorCreated = z.infer<typeof InstructorCreated>;

type RawInstructorQuery = {
  categories: string[] | undefined;
  city: string | undefined;
  minRate: string | undefined;
  maxRate: string | undefined;
  minRating: string | undefined;
  availability: string | null | undefined;
  english: string | null | undefined;
  lat: string | null | undefined;
  lng: string | null | undefined;
  nearKm: string | null | undefined;
  sort: string | null | undefined;
  providerRole: string | null | undefined;
  affiliation: string | null | undefined;
};

// Server-only: builds a raw filter object from `URLSearchParams` then runs it
// through `InstructorQuery.safeParse`. Categories are deliberately passed
// through untouched so a tampered client cannot turn an invalid category into
// an unfiltered query; the canonical enum rejects it at this boundary. Returns
// `{ ok: true, value }` on success or
// `{ ok: false, error }` so the handler can emit `error.flatten().fieldErrors`
// in the same shape the existing routes use.
export function parseInstructorQuery(
  searchParams: URLSearchParams,
): { ok: true; value: InstructorQuery } | { ok: false; error: z.ZodError } {
  const categories = searchParams.getAll('categories');
  const raw: RawInstructorQuery = {
    categories: categories.length > 0 ? categories : undefined,
    city: searchParams.get('city') ?? undefined,
    minRate: searchParams.get('minRate') ?? undefined,
    maxRate: searchParams.get('maxRate') ?? undefined,
    minRating: searchParams.get('minRating') ?? undefined,
    availability: searchParams.get('availability') ?? undefined,
    english: searchParams.get('english'),
    lat: searchParams.get('lat'),
    lng: searchParams.get('lng'),
    nearKm: searchParams.get('nearKm'),
    sort: searchParams.get('sort'),
    providerRole: searchParams.get('providerRole'),
    affiliation: searchParams.get('affiliation'),
  };
  // The geo fields are parsed-into-typed values via the schema's own coerce,
  // so out-of-range or half-paired `lat`/`lng` etc. fall back to `undefined`
  // (the schema's `safeParse` strips them on failure); the resulting query
  // silently reverts to "no geo filter applied" without 400ing the page.
  const parsed = InstructorQuery.safeParse({
    categories: raw.categories,
    city: raw.city,
    minRate: raw.minRate,
    maxRate: raw.maxRate,
    minRating: raw.minRating,
    availability: raw.availability,
    english: parseEnglish(raw.english),
    lat: parseCoord(raw.lat, -90, 90),
    lng: parseCoord(raw.lng, -180, 180),
    nearKm: parseInteger(raw.nearKm),
    sort: parseSort(raw.sort),
    providerRole: parseProviderRole(raw.providerRole),
    affiliation: parseAffiliation(raw.affiliation),
  });
  if (!parsed.success) return { ok: false, error: parsed.error };
  return { ok: true, value: parsed.data };
}

function parseEnglish(raw: string | null | undefined): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

function parseCoord(raw: string | null | undefined, min: number, max: number): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return undefined;
  return n;
}

function parseInteger(raw: string | null | undefined): number | undefined {
  if (raw == null || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return undefined;
  return n;
}

function parseSort(raw: string | null | undefined): 'distance' | 'default' | undefined {
  if (raw === 'distance' || raw === 'default') return raw;
  return undefined;
}

function parseProviderRole(
  raw: string | null | undefined,
): 'INSTRUCTOR' | 'HANDLEDARE' | undefined {
  if (raw === 'INSTRUCTOR' || raw === 'HANDLEDARE') return raw;
  return undefined;
}

function parseAffiliation(
  raw: string | null | undefined,
): 'school' | 'independent' | 'all' | undefined {
  if (raw === 'school' || raw === 'independent' || raw === 'all') return raw;
  return undefined;
}
