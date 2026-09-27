// @polsia:user-owned — signup capability disclosure (age floors only).
// Facial age-estimation retired 2026-09-27; verified DOB comes from ID KYC.

import { z } from 'zod';

export const SignupCapabilities = z.object({
  minLearnerAgeYears: z.number().int().positive(),
  minInstructorLicenseYears: z.number().int().positive(),
});

export type SignupCapabilities = z.infer<typeof SignupCapabilities>;
