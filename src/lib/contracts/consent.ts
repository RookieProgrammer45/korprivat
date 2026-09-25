// @polsia:user-owned — shared zod contracts for the consent banner / API.
//
// Single source of truth shared between the consent banner client island
// (`src/components/custom/consent-banner.tsx`), the route handler
// (`src/app/api/consent/route.ts`), and the admin table page. Server and
// client import from here so shape drift is a `ZodError`, not a silent
// mis-parse.

import { z } from 'zod';

/** The decision shape one visitor submits per consent prompt. `essential`
 *  is locked to true (the service cannot run without it) — the schema
 *  enforces the immutability on the wire so a malicious client can't
 *  attempt to set it false. */
export const ConsentDecisionScope = z.object({
  essential: z.literal(true),
  analytics: z.boolean(),
  marketing: z.boolean(),
});
export type ConsentDecisionScope = z.infer<typeof ConsentDecisionScope>;

/** What the banner UI stamps onto a decision: which surface captured it
 *  (cookie banner / signup / license upload), so the audit row is
 *  attributable to its origin. */
export const ConsentSourceEnum = z.enum(['banner', 'signup', 'license-upload']);
export type ConsentSource = z.infer<typeof ConsentSourceEnum>;

/** POST /api/consent body. */
export const ConsentEventInput = z.object({
  policyVersion: z.string().min(1),
  scope: ConsentDecisionScope,
  source: ConsentSourceEnum,
});
export type ConsentEventInput = z.infer<typeof ConsentEventInput>;

/** Response shape GET /api/consent returns to the banner on rehydration
 *  — `subjectId` is the opaque per-visitor id minted server-side and
 *  mirrored in the cookie so the next banner remount can skip its prompt
 *  without round-tripping through the server. */
export const ConsentState = z.object({
  policyVersion: z.string(),
  scope: ConsentDecisionScope,
  source: ConsentSourceEnum,
  subjectId: z.string(),
  acceptedAt: z.string(),
});
export type ConsentState = z.infer<typeof ConsentState>;

/** Admin GET /api/admin/consent response — last 200 events, with the
 *  scope JSON parsed for the table to render booleans. */
export const AdminConsentItem = z.object({
  id: z.string(),
  userId: z.string().nullable(),
  policyVersion: z.string(),
  scope: ConsentDecisionScope,
  source: z.string(),
  acceptedAt: z.string(),
});
export const AdminConsentList = z.object({
  items: z.array(AdminConsentItem),
});
export type AdminConsentList = z.infer<typeof AdminConsentList>;
