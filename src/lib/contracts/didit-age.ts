// @polsia:user-owned — contracts for Didit learner age check.
import { z } from 'zod';

export const SignupCapabilities = z.object({
  diditAgeCheck: z.boolean(),
  minLearnerAgeYears: z.number().int().positive(),
  minInstructorLicenseYears: z.number().int().positive(),
});
export type SignupCapabilities = z.infer<typeof SignupCapabilities>;

export const AgeCheckResponse = z.object({
  eligible: z.boolean(),
  status: z.enum(['Approved', 'Declined', 'In Review', 'Not Finished', 'Unavailable']),
  estimatedAge: z.number().nullable(),
  requestId: z.string().nullable(),
  warnings: z.array(z.string()),
});
export type AgeCheckResponse = z.infer<typeof AgeCheckResponse>;
