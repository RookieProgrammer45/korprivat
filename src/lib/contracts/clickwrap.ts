// @polsia:user-owned — shared zod contracts for the handledare clickwrap.
//
// Single source of truth shared between the clickwrap step in the
// `src/components/custom/sign-up-form.tsx` wizard, the
// /dashboard/handledare renewal card client island, and the
// /api/clickwrap route handler. Both server and client import from
// here so shape drift is a `ZodError`, not silent drift.
//
// `HANDLEDARE_TERMS_VERSION` is the constant the wizard stamps on the
// POST upsert and the dashboard guard compares against the row's
// stored version to detect a stale (terms-bump) acceptance.

import { z } from 'zod';

/** Bump this constant when the placeholder terms text changes — the
 *  dashboard guard forces re-consent on any row whose stored
 *  `termsVersion` is less than this value. Format: semver-ish. */
export const HANDLEDARE_TERMS_VERSION = 'v1.0.0';

/** User-side companion type — the three-role union used wherever user
 *  code branches on a marketplace role (the wizard, the dashboard
 *  guard, the profile page, the dashboard router). The framework-owned
 *  `RoleEnum` in @/lib/contracts/auth is intentionally narrower
 *  (STUDENT | INSTRUCTOR) because the framework-owned /api/auth/welcome
 *  and /api/auth/signup-redirect routes cannot be widened — those
 *  pass through HANDLEDARE exclusively via the user-owned
 *  /api/clickwrap. */
export type MarketplaceRole = 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';

/** POST /api/clickwrap body. */
export const ClickwrapAccept = z.object({
  termsVersion: z.string().min(1),
});
export type ClickwrapAccept = z.infer<typeof ClickwrapAccept>;

/** GET /api/clickwrap response — nullable so a missing row returns
 *  `null` (the route returns `NextResponse.json(null)`) without a
 *  shape mismatch on the client. */
export const CurrentAcceptance = z.object({
  termsVersion: z.string(),
  acceptedAt: z.string(),
});
export type CurrentAcceptance = z.infer<typeof CurrentAcceptance>;
