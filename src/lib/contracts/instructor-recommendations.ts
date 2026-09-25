// @polsia:user-owned — shared zod contract for the AI-ranked instructor
// recommendation payload returned by GET /api/instructors/recommendations.
//
// The route handler projects a managed set of `Instructor` rows into this
// shape, then asks the AI to rank the (still small) candidate set against
// the signed-in student's selected category / city / availability anchor.
// `Instructor.email` is intentionally omitted — same PII-safe rule that
// keeps `PUBLIC_INSTRUCTOR_SELECT` email-free.
//
// `null items` is the "learner has no category/city yet" affordance; the
// island treats that case as "section is hidden" so we don't render an
// empty placeholder.
import { z } from 'zod';

// 0..1 score the LLM assigns — bounded so a future UI can render a
// progress bar without extra sanitisation.
export const RecommendationScore = z.object({
  score: z.number().min(0).max(1),
  // Short string the assistant returns explaining the city/category fit.
  reason: z.string().min(1).max(180),
});

// Read shape: matched instructor card on the student dashboard.
export const RecommendedInstructor = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  categories: z.array(z.string()),
  hourlyRateSek: z.number().int().nonnegative(),
  photoUrl: z.string(),
  bookedHours: z.number().int().nonnegative(),
  englishSpeaking: z.boolean(),
  score: RecommendationScore.shape.score,
  reason: RecommendationScore.shape.reason,
  // Earliest upcoming open slot for this instructor — projected from
  // `AvailabilitySlot.startsAt` (slot.bookedAt IS NULL && startsAt > now).
  // `nullable` so the pill renders nothing when nothing is open yet.
  nextSlotAt: z.string().datetime().nullable(),
});

export const InstructorRecommendations = z.object({
  // Empty when the learner has no category/city anchor yet — the island
  // turns that into "section hidden" via `return null`.
  items: z.array(RecommendedInstructor),
});

export type InstructorRecommendations = z.infer<typeof InstructorRecommendations>;
export type RecommendedInstructor = z.infer<typeof RecommendedInstructor>;
