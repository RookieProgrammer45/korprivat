// and server both import this so a single schema is the source of truth for
// the booking write shape and the success-view payload.
import { z } from 'zod';
import { LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import { ReceiptEmailDeliveryStatusEnum } from '@/lib/contracts/receipts';

// Inline literal tuple of cancellation tiers. Same reason as in the
// `instructors` contract: zod's `z.enum(T)` narrows to a literal union
// only when `T` is a literal tuple, NOT a `readonly CancellationTier[]`
// reference imported from another file. Without the inline tuple the
// tier fields widen to `string` and `instructor.cancellationPolicyTier
// ?? 'flexible'` stops being a `CancellationTier` at the use sites.
const CANCELLATION_TIERS = ['flexible', 'moderate', 'strict'] as const;

// `mode` on the booking request / read shape — 'instant' (default) or
// 'request'. `'instant'` is the existing direct marketplace flow: learner
// books → Stripe checkout → held escrow; `'request'` is the new path: the
// learner sends a booking request, the row sits in `paymentStatus =
// 'awaiting_approval'`, the instructor accepts or declines; on approve the
// system mints the Stripe checkout session for the learner to pay.
export const BookingCreateModeEnum = z.enum(['instant', 'request']);
export type BookingCreateMode = z.infer<typeof BookingCreateModeEnum>;

// Write shape: the booking request the client POSTs to /api/bookings.
//
// `slotId` selects a real open `AvailabilitySlot` the instructor previously
// released; the route handler resolves `Booking.preferredAt` from
// `slot.startsAt` on the server so the storage column stays authoritative
// and the email body never drifts from the booked instant. We removed
// `preferredAt` from this INPUT shape when the slot picker shipped — the
// slot is the only thing the server is allowed to write anyway.
//
// `category` is validated against the canonical licence-category enum rather
// than the storage column, so a tampered client cannot submit a bogus code.
//
// `mode` defaults to 'instant' so existing callers see no change. The route
// handler reads the live instructor's `bookingMode` to validate that the
// submitted mode matches the published one. A learner booking against a
// request-mode instructor with `mode='instant'` is a 409 — UI surfaces it.
export const BookingCreate = z.object({
  studentName: z.string().min(1, 'Name is required').max(120, 'Name is too long'),
  studentEmail: z.string().email('Enter a valid email'),
  studentPhone: z.string().min(1, 'Phone is required').max(40, 'Phone is too long'),
  category: z.enum(LICENCE_CATEGORY_CODES, {
    message: 'Pick one of the instructor certified categories',
  }),
  slotId: z.string().min(1, 'Pick an available time slot'),
  instructorId: z.string().min(1),
  mode: BookingCreateModeEnum.optional(),
  locale: z.enum(['sv', 'en']).optional(),
});

// Response shape returned by the server after a successful booking insert.
// `hourlyRateSek` is re-fetched from the persisted instructor without an
// `include` across the relation so the success view can render "<rate> SEK/hr"
// in a single round trip. The per-booking fee breakdown snapshot is
// stamped at the payment-link / accept transitions and surfaces via the
// `BookingRead` shape; this minimal response carries the row id + the
// current hourly rate the booking was created against.
export const BookingCreated = z.object({
  id: z.string(),
  hourlyRateSek: z.number().int().nonnegative(),
  // Returned once so an anonymous learner can reach the canonical booking
  // detail page without making the booking id itself an authorization grant.
  learnerAccessToken: z.string().min(1),
});

export type BookingCreate = z.infer<typeof BookingCreate>;
export type BookingCreated = z.infer<typeof BookingCreated>;

// ---------------------------------------------------------------- Payment --

// `unpaid`     — booking row exists, no Stripe checkout session minted yet.
// `pending`    — server minted a Stripe checkout session (id stored on the row)
//                and the learner is at the hosted checkout / has been redirected back.
// `paid`       — LEGACY value from the pre-escrow flow. Kept on the read
//                contract so a BookingRead over a historical row still parses;
//                no new writes target this state.
// `held_escrow`— `verifyCheckoutSession` confirmed; funds sit in escrow until
//                the lesson is marked complete via /api/bookings/[id]/complete.
// `released`   — both parties (or one + token) confirmed completion; the
//                company-side funds are released.
// `refunded`   — a dispute was resolved as a refund; the operator settles
//                the Stripe refund out-of-band.
// `cancelled_early` — LEGACY pre-tier value kept on BookingRead for
//                     historical rows; no new writes target this state.
//                     New writes route to one of the tier-aware outcomes:
//                       `cancelled_full_refund` — outside the tier's
//                         full-refund window; no fee, slot freed.
//                       `cancelled_partial`    — inside the tier's partial
//                         window (between full-refund and <24h); fee at
//                         tier.partialFeePercent.
//                       `cancelled_late`       — within LATE_WINDOW_HOURS
//                         (24h before the lesson); fee at 100% of the
//                         lesson charge. The route recorded a
//                         `LateCancellationFee` row.
// `awaiting_approval` — INSTANT-vs-REQUEST flow: the booking was created
//                       against a Request-mode instructor, the slot is NOT
//                       reserved, and we're waiting for the instructor's
//                       approve / decline. Terminal `declined` flips the
//                       row off this state.
// `declined`   — INSTANT-vs-REQUEST flow: the instructor declined the
//                request before any payment was captured. Terminal — no
//                re-flow possible from the client.
export const BookingPaymentStatusEnum = z.enum([
  'unpaid',
  'pending',
  'paid',
  'held_escrow',
  'released',
  'refunded',
  'cancelled_early',
  'cancelled_late',
  'cancelled_full_refund',
  'cancelled_partial',
  'awaiting_approval',
  'declined',
]);
export type BookingPaymentStatus = z.infer<typeof BookingPaymentStatusEnum>;

// Mirror of `Booking.disputeStatus` for the read surface.
export const DisputeStatusEnum = z.enum(['open', 'resolved_released', 'resolved_refunded']);
export type DisputeStatus = z.infer<typeof DisputeStatusEnum>;

// Cancellation outcome values mirror Booking.cancellationOutcome. Access
// to the per-tier rule (POLICIES / getPolicyForTier) lives in
// src/lib/business/cancellation-policy.ts — both the route handler and
// the client form import it.
export const CancellationOutcomeEnum = z.enum([
  'cancelled_early',
  'cancelled_full_refund',
  'cancelled_partial',
  'cancelled_late',
]);
export type CancellationOutcome = z.infer<typeof CancellationOutcomeEnum>;

// Read shape for `GET /api/bookings/[id]`. The instructor's `hourlyRateSek`
// is loaded by the route handler via a separate query (no `include` across
// the @relation) and joined into the response here so the client island can
// render both the rate pill and the live payment status in one round trip.
export const BookingCancellationTerms = z.object({
  tier: z.enum(CANCELLATION_TIERS),
  fullRefundBeforeHours: z.number().nonnegative(),
  partialRefundWindowHours: z.number().nonnegative(),
  partialFeePercent: z.number().int().min(0).max(100),
  fullFeeWindowHours: z.number().nonnegative(),
});
export type BookingCancellationTerms = z.infer<typeof BookingCancellationTerms>;

export const BookingRead = z.object({
  id: z.string(),
  instructorId: z.string(),
  providerName: z.string(),
  providerCity: z.string(),
  category: z.enum(LICENCE_CATEGORY_CODES),
  slotId: z.string().nullable(),
  durationMinutes: z.number().int().positive(),
  scheduledAt: z.string().datetime(),
  preferredAt: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
  hourlyRateSek: z.number().int().nonnegative(),
  // Escrow state — all nullable so legacy (pre-escrow) rows parse; only
  // `held_escrow`/`released`/`refunded` bookings populate them.
  heldAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  disputeStatus: DisputeStatusEnum.nullable(),
  // Cancellation state — all nullable on a fresh or in-progress booking.
  cancellationOutcome: CancellationOutcomeEnum.nullable(),
  cancelledAt: z.string().nullable(),
  cancelledByRole: z.enum(['learner', 'instructor']).nullable(),
  // Snapshot of the instructor's cancellation-policy tier AT BOOKING TIME.
  // Surfaced on the booking detail + cancel form so the learner sees the
  // tier schedule without a second fetch to the instructor's profile.
  cancellationPolicyTier: z.enum(CANCELLATION_TIERS).nullable(),
  cancellationTerms: BookingCancellationTerms.nullable(),
  // Snapshot of the instructor's booking mode at booking time. The success
  // page branches on this — a Request row never shows a "Pay for the
  // lesson" CTA; an Instant row never shows the awaiting-approval card.
  // Nullable so legacy rows (pre-`bookingMode` column) parse cleanly;
  // the read path defaults to 'instant'.
  bookingMode: BookingCreateModeEnum.nullable(),
  // Per-booking fee snapshots — all nullable so pre-FeeModel rows
  // (rows that were charged before the `Booking.{priceAmountSek,
  // serviceFeeSek, grossChargedSek}` columns shipped)
  // parse cleanly. The values were stamped ONCE at the payment-link /
  // accept transition so the figures cannot shift if the instructor
  // later changes their published `hourlyRateSek`.
  priceAmountSek: z.number().int().nonnegative().nullable(),
  serviceFeeSek: z.number().int().nonnegative().nullable(),
  grossChargedSek: z.number().int().nonnegative().nullable(),
  locale: z.enum(['sv', 'en']).nullable(),
  receiptEmailStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
  providerRole: z.enum(['INSTRUCTOR', 'HANDLEDARE']),
  capabilities: z.object({
    canAccept: z.boolean(),
    canDecline: z.boolean(),
    canCancel: z.boolean(),
    canComplete: z.boolean(),
    nextStates: z.array(BookingPaymentStatusEnum),
  }),
});
export type BookingRead = z.infer<typeof BookingRead>;

export const BookingPaymentLinkRequest = z.object({
  token: z.string().min(1).optional(),
});
export type BookingPaymentLinkRequest = z.infer<typeof BookingPaymentLinkRequest>;

// Response shape for `POST /api/bookings/[id]/payment-link`. `url` is null
// when the booking is already paid (or in a terminal escrow state) — the
// client uses that to render the badge in place of the button.
export const BookingPaymentLinkResponse = z.object({
  url: z.string().url().nullable(),
  paymentStatus: BookingPaymentStatusEnum,
});
export type BookingPaymentLinkResponse = z.infer<typeof BookingPaymentLinkResponse>;

// ─── Booking history (learner-facing) ────────────────────────────────────
//
// Read shape for the student-side history view (`GET /api/bookings/me/history`).
// One row per Booking owned by the signed-in learner — instructor + city +
// category + preferred instant + the live `hourlyRateSek` (read across the
// @relation via a separate `prisma.instructor.findMany` rather than an
// `include`) + the live payment status + escrow/cancellation signal columns
// so the client can split past/upcoming and pick a status badge in one round
// trip. The route is owner-scoped (`requireAuth` + `userId`/email WHERE) so
// a learner can never see another learner's row.
export const BookingHistoryItem = z.object({
  id: z.string(),
  instructorId: z.string(),
  instructorName: z.string(),
  city: z.string(),
  category: z.string(),
  preferredAt: z.string(),
  scheduledAt: z.string().datetime().optional(),
  slotId: z.string().nullable().optional(),
  durationMinutes: z.number().int().positive().optional(),
  providerRole: z.enum(['INSTRUCTOR', 'HANDLEDARE']).optional(),
  hourlyRateSek: z.number().int().nonnegative(),
  paymentStatus: BookingPaymentStatusEnum,
  cancellationOutcome: CancellationOutcomeEnum.nullable(),
  cancelledAt: z.string().nullable(),
  completedAt: z.string().nullable(),
  disputeStatus: DisputeStatusEnum.nullable(),
  // Per-booking fee snapshots — all nullable so pre-FeeModel rows parse
  // cleanly. `grossChargedSek` is what the learner actually paid on the
  // row's lifecycle (including any stored historical fee snapshot). `priceAmountSek` is the
  // underlying hourly rate snapshotted at the time the checkout session
  // was minted.
  priceAmountSek: z.number().int().nonnegative().nullable(),
  serviceFeeSek: z.number().int().nonnegative().nullable(),
  grossChargedSek: z.number().int().nonnegative().nullable(),
  receiptAvailable: z.boolean(),
  receiptEmailStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
});
export type BookingHistoryItem = z.infer<typeof BookingHistoryItem>;

export const BookingHistoryList = z.object({
  items: z.array(BookingHistoryItem),
});
export type BookingHistoryList = z.infer<typeof BookingHistoryList>;

// Response shape for `GET /api/bookings/[id]/payment-poll`. `verified`
// flips to true exactly once — the server keeps the row update behind a
// conditional `where: { paymentStatus: { notIn: [...] } }` so a racing
// second poll cannot double-fulfill.
export const BookingPaymentPollResponse = z.object({
  verified: z.boolean(),
  paymentStatus: BookingPaymentStatusEnum,
  receiptEmailStatus: ReceiptEmailDeliveryStatusEnum.nullable(),
});
export type BookingPaymentPollResponse = z.infer<typeof BookingPaymentPollResponse>;

// ─── Escrow action shapes ────────────────────────────────────────────────

const RoleEnum = z.enum(['learner', 'instructor']);

export const BookingCompleteRequest = z.object({
  token: z.string().min(1, 'Missing action token').optional(),
  completedByRole: RoleEnum.optional(),
  completedByLabel: z.string().min(1, 'Name is required').max(120),
});
export type BookingCompleteRequest = z.infer<typeof BookingCompleteRequest>;

export const BookingDisputeOpenRequest = z.object({
  token: z.string().min(1, 'Missing action token'),
  openedByRole: RoleEnum,
  openedByLabel: z.string().min(1, 'Name is required').max(120),
  reason: z.string().min(1, 'Reason is required').max(2000),
});
export type BookingDisputeOpenRequest = z.infer<typeof BookingDisputeOpenRequest>;

export const BookingDisputeResolveRequest = z.object({
  token: z.string().min(1, 'Missing action token'),
  outcome: z.enum(['released', 'refunded']),
  resolvedByLabel: z.string().min(1, 'Name is required').max(120),
  resolutionNote: z.string().max(2000).optional(),
});
export type BookingDisputeResolveRequest = z.infer<typeof BookingDisputeResolveRequest>;

export const BookingCompleteResponse = z.object({
  id: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
  completedAt: z.string().nullable(),
  payoutReleasedAt: z.string().nullable(),
});
export type BookingCompleteResponse = z.infer<typeof BookingCompleteResponse>;

export const BookingDisputeResponse = z.object({
  id: z.string(),
  disputeStatus: DisputeStatusEnum,
});
export type BookingDisputeResponse = z.infer<typeof BookingDisputeResponse>;

// ─── Cancellation shapes ────────────────────────────────────────────────

// POST /api/bookings/[id]/cancel — token-protected, like complete / dispute.
// `cancelledByRole` is optional so the server can fall back to 'learner'
// when the deep-link holder's role can't be inferred; the resolved role
// lands on the booking row's `cancelledByRole` and comes back in the
// response so the client UI can mirror it without a second read.
export const BookingCancelRequest = z.object({
  token: z.string().min(1, 'Missing action token').optional(),
  cancelledByRole: RoleEnum.optional(),
  cancelledByLabel: z.string().min(1, 'Name is required').max(120),
});
export type BookingCancelRequest = z.infer<typeof BookingCancelRequest>;

// Response shape mirrors the route's terminal commit. `feeAmountUsd` is
// non-null only on a `cancelled_late` outcome so the client can render
// the fee receipt card vs. the neutral cancellation card.
export const BookingCancelResponse = z.object({
  id: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
  cancellationOutcome: CancellationOutcomeEnum,
  cancelledAt: z.string(),
  feeAmountUsd: z.number().int().nonnegative().nullable(),
});
export type BookingCancelResponse = z.infer<typeof BookingCancelResponse>;

// ─── Instant-vs-Request approval / decline shapes ────────────────────
//
// Both deep-link routes flow the action token from the email row, the
// instructor's chosen `acceptedByLabel` / `declineByLabel`, and (decline
// only) an optional human-readable `reason`. The pattern mirrors
// `BookingCancelRequest` so the existing `assertTokenMatches` flow in
// `src/lib/business/escrow.ts` continues to gate the routes.
export const BookingAcceptRequest = z.object({
  token: z.string().min(1, 'Missing action token').optional(),
  acceptedByLabel: z.string().min(1, 'Name is required').max(120),
});
export type BookingAcceptRequest = z.infer<typeof BookingAcceptRequest>;

export const BookingDeclineRequest = z.object({
  token: z.string().min(1, 'Missing action token').optional(),
  declinedByLabel: z.string().min(1, 'Name is required').max(120),
  reason: z.string().max(2000).optional(),
});
export type BookingDeclineRequest = z.infer<typeof BookingDeclineRequest>;

// Accept response carries paymentStatus to the client so the
// confirm-payment page knows whether to render the "Pay lesson" CTA.
export const BookingAcceptResponse = z.object({
  id: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
  // Set when the row still carries a slot reservation waiting to clear so
  // the client can render the new "Confirm & pay" deep link. The route
  // writes this for the standard Request-mode path. Null on the rare
  // case the row was minted without a slot (an unsubscribe / future
  // origin: e.g. a $0 free trial).
  actionUrl: z.string().nullable(),
});
export type BookingAcceptResponse = z.infer<typeof BookingAcceptResponse>;

export const BookingDeclineResponse = z.object({
  id: z.string(),
  paymentStatus: BookingPaymentStatusEnum,
});
export type BookingDeclineResponse = z.infer<typeof BookingDeclineResponse>;

// ─── Rebook prefill (per-instructor lookup) ──────────────────────────────
//
// Mirrors the `RebookPrefill` on `src/lib/contracts/saved-payment-methods.ts`
// but kept here so the `BookingForm` client island can co-import the prefill
// shape next to `BookingCreate` / `BookingRead` / the slot list without
// pulling the saved-payment methods envelope onto the same render pass.
// The shape MUST stay in lockstep — both contracts carry the same five
// fields and are validated server-side in the rebook-suggest route.
// `studentEmail` is a typing-convenience lift (the contract on
// `saved-payment-methods.ts` validates it as `email()` too) so the
// booking form can default the email input without a second parse.
export const RebookPrefillForm = z.object({
  instructorId: z.string(),
  category: z.string(),
  studentName: z.string(),
  studentEmail: z.string().email(),
  studentPhone: z.string(),
  hourlyRateSek: z.number().int().nonnegative(),
  preferredAt: z.string(),
});
export type RebookPrefillForm = z.infer<typeof RebookPrefillForm>;
