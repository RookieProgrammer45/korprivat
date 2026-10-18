// Public read shapes for the Google-review snapshot (prisma `GoogleReview`
// + the `Instructor.google*` columns). Zod-only module so the client island
// can import it — same discipline as contracts/reviews.ts (no server-only
// imports). Rows are written by the weekly Google backfill job; the public
// route is GET-only and never exposes sync internals beyond `syncedAt`.
import { z } from 'zod';

export const GoogleReviewItem = z.object({
  id: z.string(),
  instructorId: z.string(),
  authorName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  publishTime: z.string().datetime().nullable(),
  relativeTime: z.string().nullable(),
});

export const GoogleReviewSummary = z.object({
  rating: z.number().min(0).max(5),
  count: z.number().int().nonnegative(),
  mapsUri: z.string().nullable(),
  syncedAt: z.string().datetime().nullable(),
});

// GET response envelope. `summary` is null when the school has no resolved
// Google Place yet; `items` can still carry rows in that edge case, so the
// client island hides the whole section only when BOTH are absent.
export const GoogleReviewList = z.object({
  items: z.array(GoogleReviewItem),
  summary: GoogleReviewSummary.nullable(),
});

export type GoogleReviewItem = z.infer<typeof GoogleReviewItem>;
export type GoogleReviewSummary = z.infer<typeof GoogleReviewSummary>;
export type GoogleReviewList = z.infer<typeof GoogleReviewList>;
