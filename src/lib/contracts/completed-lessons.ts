// @polsia:user-owned — shared completed-lesson dashboard response contract.
// Keep this client-safe: the route and the dashboard island both parse this
// shape so the summary cannot drift from its data source.
import { z } from 'zod';

export const CompletedLessonProviderRole = z.enum(['INSTRUCTOR', 'HANDLEDARE']);

export const CompletedLessonItem = z.object({
  id: z.string(),
  learnerName: z.string(),
  category: z.string(),
  lessonDate: z.string().datetime(),
  completionDate: z.string().datetime(),
});

export const CompletedLessonsResponse = z.object({
  count: z.number().int().nonnegative(),
  providerRole: CompletedLessonProviderRole.nullable(),
  items: z.array(CompletedLessonItem).max(5),
});

export type CompletedLessonProviderRole = z.infer<typeof CompletedLessonProviderRole>;
export type CompletedLessonItem = z.infer<typeof CompletedLessonItem>;
export type CompletedLessonsResponse = z.infer<typeof CompletedLessonsResponse>;
