// module client-importable: zod only, no server-only imports.
import { z } from 'zod';

// Write shape: fields a client may submit when creating a review. `bookingId`
// is required so the server can verify completion and ownership. `rating`
// is validated as an integer 1-5 here because `prisma db push` cannot
// reliably apply a Postgres CHECK constraint for that range in this stack.
export const ReviewCreate = z.object({
  instructorId: z.string().min(1, 'instructorId is required'),
  bookingId: z.string().min(1, 'bookingId is required'),
  reviewerName: z
    .string()
    .min(1, 'Reviewer name is required')
    .max(120, 'Reviewer name is too long'),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(1, 'Comment is required'),
});

// Public read shape: booking identifiers are intentionally omitted from this
// response so public instructor pages never expose private booking context.
export const ReviewItem = z.object({
  id: z.string(),
  instructorId: z.string(),
  reviewerName: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string(),
  createdAt: z.string(),
});

export const ReviewEligibility = z.object({
  status: z.enum(['eligible', 'not_eligible', 'already_reviewed']),
});

// Read shape: persisted record returned by the server. `createdAt` is a
// string in the JSON envelope because NextResponse.json serializes DateTime
// to ISO; the route handler maps the Prisma DateTime column to a string.
// GET response envelope.
export const ReviewList = z.object({
  items: z.array(ReviewItem),
  eligibility: ReviewEligibility.optional(),
});

export type ReviewCreate = z.infer<typeof ReviewCreate>;
export type ReviewItem = z.infer<typeof ReviewItem>;
export type ReviewEligibility = z.infer<typeof ReviewEligibility>;
export type ReviewList = z.infer<typeof ReviewList>;
