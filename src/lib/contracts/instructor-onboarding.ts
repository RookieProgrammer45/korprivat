import { z } from 'zod';

export const InstructorOnboardingRole = z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE']);

export const InstructorOnboardingContext = z.object({
  role: InstructorOnboardingRole,
});

export type InstructorOnboardingContext = z.infer<typeof InstructorOnboardingContext>;
