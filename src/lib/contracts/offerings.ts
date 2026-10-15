//
// Zod contracts for marketplace offerings: the public price list on a
// profile, the seller's dashboard CRUD, and the learner "request to book"
// flow. Purely zod (no server-only imports) so client islands and route
// handlers share one source of truth.
import { z } from 'zod';

export const OFFERING_KINDS = ['LEKTION', 'INTENSIVKURS', 'PAKET'] as const;
export const OfferingKindEnum = z.enum(OFFERING_KINDS);
export type OfferingKind = (typeof OFFERING_KINDS)[number];

// Public read shape (GET /api/instructors/[id]/offerings). Inactive rows and
// internal fields (sortOrder, timestamps) stay server-side.
export const PublicOffering = z.object({
  id: z.string(),
  kind: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  priceSek: z.number().int().nonnegative(),
  sessions: z.number().int().positive().nullable(),
  weeks: z.number().int().positive().nullable(),
});
export const PublicOfferingList = z.object({ items: z.array(PublicOffering) });
export type PublicOffering = z.infer<typeof PublicOffering>;

// Seller dashboard read shape — adds the active flag so the editor can
// manage hidden rows too.
export const OwnOffering = PublicOffering.extend({
  active: z.boolean(),
});
export const OwnOfferingList = z.object({ items: z.array(OwnOffering) });
export type OwnOffering = z.infer<typeof OwnOffering>;

// Create/update payload (POST/PATCH). Price is a SEK integer; sessions,
// weeks and description optional. PATCH handlers parse the partial() form so
// single-field updates (e.g. the active toggle) stay cheap.
export const OfferingUpsert = z.object({
  kind: OfferingKindEnum,
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
  description: z.string().trim().max(800, 'Description is too long').optional().nullable(),
  priceSek: z.number().int('Price must be a whole number').min(0).max(1_000_000),
  sessions: z.number().int().min(1).max(99).optional().nullable(),
  weeks: z.number().int().min(1).max(52).optional().nullable(),
  active: z.boolean().optional(),
});
export type OfferingUpsertInput = z.infer<typeof OfferingUpsert>;
export const OfferingUpserted = z.object({ id: z.string() });
export const OfferingDeleted = z.object({ ok: z.boolean() });

// Learner request ("Begär bokning") — public, like the contact form.
export const OfferingRequestCreate = z.object({
  offeringId: z.string().min(1),
  studentName: z.string().trim().min(1, 'Name is required').max(120),
  studentEmail: z.string().trim().email('Enter a valid email').max(200),
  studentPhone: z.string().trim().min(1, 'Phone is required').max(40),
  preferredStart: z.string().trim().max(120).optional(),
  message: z.string().trim().max(1000).optional(),
  locale: z.enum(['sv', 'en']).optional(),
});
export const OfferingRequestCreated = z.object({ ok: z.boolean() });
