//
// The auth flows themselves (signIn/signUp/signOut/getSession) go through
// better-auth's framework types — those are the source of truth for the
// sign-in / sign-up wires. These schemas are for the SHAPES this app owns
// that flow across the wire alongside auth:
//   - the role we store on UserProfile (mirrors WaitlistRole)
//   - a thin /api/auth/welcome request body and PostLoginRedirect payload
//   - the bookings read shapes used by the role-stubs on the (dashboard) page
//     so the islands can re-use the same parse path as the booking detail page.
import { z } from 'zod';
import { BookingPaymentStatusEnum } from '@/lib/contracts/bookings';
import { ReceiptEmailDeliveryStatusEnum } from '@/lib/contracts/receipts';

// Re-export the privacy-version constant so client code (sign-up form, banner) only
// needs to import from one place. The single source of truth lives in privacy.ts.
export { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

// Mirror of prisma/schema/user-profile.prisma's Role enum (the prisma enum
// has STUDENT/INSTRUCTOR/HANDLEDARE — this wire copy only carries the values
// the framework-owned routes can accept: the welcome route's dashboardUrlFor
// helper is parameter-typed `'STUDENT' | 'INSTRUCTOR'` and we can't widen it
// without owning that file. HANDLEDARE is intentionally absent here so any
// apiFetch through this contract stays validated against the framework's
// accepted shape.
// The waitlist module guards a similar WaitlistRole (separate, framework_owned).
// Both resolve to 'STUDENT' | 'INSTRUCTOR' on the wire; this copy exists
// because (a) the auth better-auth types are framework-owned and we cannot
// import them here, and (b) the dashboard islands need a parseable shape to
// render the role.
export const RoleEnum = z.enum(['STUDENT', 'INSTRUCTOR']);
export type Role = z.infer<typeof RoleEnum>;

// Request body for POST /api/auth/welcome — the email the signup form just
// submitted, so the route can sanity-check it matches the freshly-set session
// before sending the welcome (the gate against a random user triggering
// another user's welcome).
export const WelcomeRequest = z.object({
  email: z.string().email(),
});
export type WelcomeRequest = z.infer<typeof WelcomeRequest>;

// Generic post-login redirect hint returned by a thin helper at
// /api/auth/signup-redirect — the sign-up form POSTs the desired role there
// and gets back the role-correct dashboard path. Keeping it tiny: just the
// `to` string the client should `router.push`.
export const PostLoginRedirect = z.object({
  to: z.string().startsWith('/'),
});
export type PostLoginRedirect = z.infer<typeof PostLoginRedirect>;

// Body for POST /api/auth/social-role — fired from /oauth-complete after
// the social provider's callback. `role` is carried in the OAuth
// callbackURL (set when the user clicks the social-auth button), `next` is
// optional and lets a deep-linked user land back where they came from.
// `next` MUST be a leading-slash same-origin path; the client sanitises
// before posting, but the server contract enforces the same shape so a
// regression in the client doesn't propagate.
export const SocialRoleRequest = z.object({
  role: RoleEnum,
  next: z.string().startsWith('/').optional(),
});
export type SocialRoleRequest = z.infer<typeof SocialRoleRequest>;

// ─── Dashboard booking lists ──────────────────────────────────────────────
//
// Two read shapes that the role stub islands re-use from the seeded booking
// contract shape. Kept here (NOT in src/lib/contracts/bookings.ts) so the
// dashboard list views stay independent of the per-booking detail wiring.
// Both intentionally narrow — the dashboard only needs an at-a-glance list;
// click-through lands on /bookings/[id] for full state.

export const BookingListItem = z.object({
  id: z.string(),
  // student side: "Self" when the row's studentEmail matches the caller;
  // instructor side: the learner's name (still free-form, no FK yet).
  counterpartyName: z.string(),
  category: z.string(),
  // ISO 8601 string — the booking detail returns this as a string too so
  // islands can format with Intl.DateTimeFormat without re-parsing a Date.
  preferredAt: z.string(),
  scheduledAt: z.string().datetime().optional(),
  slotId: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  providerRole: z.enum(['INSTRUCTOR', 'HANDLEDARE']).optional(),
  cancellationOutcome: z.string().nullable().optional(),
  cancelledAt: z.string().nullable().optional(),
  completedAt: z.string().nullable().optional(),
  canCancel: z.boolean().optional(),
  canComplete: z.boolean().optional(),
  paymentStatus: BookingPaymentStatusEnum,
  receiptAvailable: z.boolean(),
  receiptAmountSek: z.number().int().nonnegative().nullable(),
  receiptStatus: z.string().nullable(),
  receiptEmailStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
});
export type BookingListItem = z.infer<typeof BookingListItem>;

export const BookingList = z.object({
  items: z.array(BookingListItem),
});
export type BookingList = z.infer<typeof BookingList>;
