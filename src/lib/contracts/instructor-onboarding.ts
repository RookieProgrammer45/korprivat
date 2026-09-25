// @polsia:user-owned — client-safe contract for the instructor onboarding context.
import { z } from 'zod';

export const InstructorOnboardingRole = z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE']);

export const InstructorOnboardingContext = z.object({
  role: InstructorOnboardingRole,
});

export type InstructorOnboardingContext = z.infer<typeof InstructorOnboardingContext>;
