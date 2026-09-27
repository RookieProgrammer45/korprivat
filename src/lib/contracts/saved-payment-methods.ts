// method + one-click rebook" surfaces.
//
// Three contracts in one file (the plan's §4) so the dashboard islands, the
// rebook helpers, and the booking form share the same parse path on the wire:
//
//   1. `SavedPaymentMethodItem` — one row from `GET /api/profile/payment-methods`.
//      Carries the buyer's email + the `brand` ("card" placeholder until the
//      proxy exposes card-meta) + `last4` (nullable, same reason) + `lastUsedAt`
//      so the dashboard island can pick the most-recent one as the default
//      sticker. `isDefault` flips on the form a learner uses to "Set default".
//
//   2. `ProfileMeReadout` — the response shape of `GET /api/profile/me`:
//      the signed-in user's `savedMethods` AND their `lastInstructors`
//      (the latter pre-filling the rebook card grid under the history
//      list). The two arrays co-publish on one round trip so the island
//      doesn't need a chained fetch.
//
//   3. `RebookSuggestResponse` — the response shape of
//      `GET /api/bookings/me/suggest-rebook?instructorId=…` — `suggested`
//      IS the (category, studentName, studentPhone) the rebook form
//      pre-fills; `null` when no prior booking exists.
//
//   4. `ProfileSavedMethodRequest` — request body for the PATCH route
//      (set-default OR forget), split from the list contract so the route
//      handler parses a body and not the list shape.
//
// All four are zod-only (NO server-only imports). Client islands import
// `apiFetch + zod`, route handlers `NextResponse.json(...)` after the same
// parse call so the wire shape is provable on both ends.

import { z } from 'zod';

export const SavedPaymentMethodItem = z.object({
  id: z.string(),
  customerEmail: z.string().email(),
  brand: z.string(),
  // `null` while the proxy does not surface card-meta. Nullable so the
  // schema parse never blocks a row that the Stripe proxy has not yet
  // enriched.
  last4: z.string().nullable(),
  // ISO 8601 — kept on the read surface so the UI can sort the "most recent"
  // and render "used …" relative timestamps.
  lastUsedAt: z.string(),
  // True on exactly one row per user (the most-recent by `lastUsedAt` at
  // create-time). Server flips this to false before a `set default` PATCH
  // and re-asserts the same `isDefault: true` on the picked row in the
  // same `prisma.$transaction` so a racing PATCH can't end up with two
  // `true` rows.
  isDefault: z.boolean(),
});
export type SavedPaymentMethodItem = z.infer<typeof SavedPaymentMethodItem>;

export const SavedPaymentMethodList = z.object({
  items: z.array(SavedPaymentMethodItem),
});
export type SavedPaymentMethodList = z.infer<typeof SavedPaymentMethodList>;

// ─── Profile envelope (saved methods + last-instructor manifest) ─────────

const ProfileLastBookedInstructor = z.object({
  // The instructor id — matches the `/instructors/[id]` route param so the
  // rebook CTA can deep-link with one click.
  id: z.string(),
  name: z.string(),
  city: z.string(),
  category: z.string(),
  hourlyRateSek: z.number().int().nonnegative(),
  // ISO 8601 — the moment the prior lesson was preferred for (drives the
  // "Preferred again {when}" hint on the rebook card).
  preferredAt: z.string(),
  // The booking.id the rebook deep-link should carry. Surfaces on the
  // href the user actually lands on so /instructors/[id]?rebook=… can
  // pre-fill from this same-row contract.
  lastBookingId: z.string(),
});
export type ProfileLastBookedInstructor = z.infer<typeof ProfileLastBookedInstructor>;

export const ProfileMeReadout = z.object({
  savedMethods: SavedPaymentMethodList,
  // Up to ~4 most-recent bookings, distinct by `instructorId` — the list
  // a learner sees on the rebook card row.
  lastInstructors: z.array(ProfileLastBookedInstructor),
});
export type ProfileMeReadout = z.infer<typeof ProfileMeReadout>;

// ─── Rebook prefill (per-instructor lookup) ─────────────────────────────

const RebookPrefill = z.object({
  instructorId: z.string(),
  category: z.string(),
  studentName: z.string(),
  studentEmail: z.string().email(),
  studentPhone: z.string(),
  // The current per-hour rate as the server sees it — used to render the
  // rebook form's "Pay" CTA. Server-computed, NEVER read from the client.
  hourlyRateSek: z.number().int().nonnegative(),
  // ISO 8601 the prior `Booking.preferredAt` value; the booking form may
  // default the slot picker to the matching slot if it's still open.
  preferredAt: z.string(),
});
export type RebookPrefill = z.infer<typeof RebookPrefill>;

export const RebookSuggestResponse = z.object({
  // `null` when the user has no prior booking with this instructor — the
  // client island renders a "no rebook yet" empty-state and skips prefill.
  suggested: RebookPrefill.nullable(),
});
export type RebookSuggestResponse = z.infer<typeof RebookSuggestResponse>;

// ─── PATCH /api/profile/payment-methods/[id] request / response ──────────

export const ProfileSavedMethodForgetRequest = z.object({
  id: z.string().min(1),
});
export type ProfileSavedMethodForgetRequest = z.infer<typeof ProfileSavedMethodForgetRequest>;

// Generic PATCH payload: action `'default'` (set this row as default) or
// `'forget'` (delete the row). The id of the route param + the body's
// `action` + the optional `email` provide the only state-changing payload
// the route accepts.
export const ProfileSavedMethodAction = z.enum(['default', 'forget']);
export type ProfileSavedMethodAction = z.infer<typeof ProfileSavedMethodAction>;

export const ProfileSavedMethodPatchRequest = z.object({
  action: ProfileSavedMethodAction,
  // Optional — `/api/profile/payment-methods` is read-only on the
  // server, but an explicit `customerEmail` lets the route validate
  // the caller's email when the user is re-saving the same address.
  customerEmail: z.string().email().optional(),
});
export type ProfileSavedMethodPatchRequest = z.infer<typeof ProfileSavedMethodPatchRequest>;

export const ProfileSavedMethodPatchResponse = z.object({
  // Echoes the `id` of the row that was updated / deleted — the island can
  // drop the row out of its optimistic UI without a refetch.
  id: z.string(),
  action: ProfileSavedMethodAction,
});
export type ProfileSavedMethodPatchResponse = z.infer<typeof ProfileSavedMethodPatchResponse>;
