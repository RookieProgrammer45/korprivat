// @polsia:user-owned — shared signup state/start/complete contracts.
import { z } from 'zod';
import { PhotoVerificationState } from '@/lib/contracts/photo-verification';
import {
  isInstructorLicenseTenureEligible,
  isLearnerAgeEligible,
  MIN_INSTRUCTOR_LICENSE_YEARS,
  MIN_LEARNER_AGE_YEARS,
} from '@/lib/signup-eligibility';

/** Persisted auth role (UserProfile.role). */
export const SignupRole = z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE']);
export type SignupRole = z.infer<typeof SignupRole>;

/** UI signup path — learner / school / certified instructor. */
export const SignupPath = z.enum(['LEARNER', 'SCHOOL', 'INSTRUCTOR']);
export type SignupPath = z.infer<typeof SignupPath>;

export const SignupPrerequisite = z.enum(['photo', 'license', 'clickwrap', 'complete']);
export type SignupPrerequisite = z.infer<typeof SignupPrerequisite>;

export const SignupState = z.object({
  role: SignupRole,
  path: SignupPath.nullable(),
  photo: PhotoVerificationState,
  nextPrerequisite: SignupPrerequisite,
  /** Learner verification machine state — present for STUDENT resumes / polling. */
  verificationState: z
    .enum([
      'SIGNED_UP',
      'BLOCKED_UNDERAGE',
      'DIDIT_PENDING',
      'DIDIT_FAILED',
      'MANUAL_REVIEW',
      'HANDLEDARE_PENDING',
      'HANDLEDARE_EXPIRED',
      'ACTIVE',
      'SUSPENDED',
    ])
    .optional(),
  diditSessionId: z.string().nullable().optional(),
});
export type SignupState = z.infer<typeof SignupState>;

export const SignupStart = z
  .object({
    path: SignupPath,
    dateOfBirth: z.string().optional(),
    phone: z.string().max(40).optional(),
    city: z.string().max(120).optional(),
    schoolName: z.string().max(160).optional(),
    organizationNumber: z.string().max(32).optional(),
    licenseHeldYears: z.coerce.number().int().min(0).max(80).optional(),
    ageEstimatedYears: z.coerce.number().min(0).max(120).optional(),
    ageCheckRequestId: z.string().max(120).optional(),
    ageCheckStatus: z.string().max(40).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.path === 'LEARNER') {
      if (!data.dateOfBirth) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateOfBirth'],
          message: `Learners must be at least ${MIN_LEARNER_AGE_YEARS} years old.`,
        });
        return;
      }
      const dob = new Date(data.dateOfBirth);
      if (Number.isNaN(dob.getTime()) || !isLearnerAgeEligible(dob)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateOfBirth'],
          message: `The youngest learner age is ${MIN_LEARNER_AGE_YEARS}.`,
        });
      }
    }
    if (data.path === 'SCHOOL') {
      if (!data.schoolName?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['schoolName'],
          message: 'Enter the driving school name.',
        });
      }
      if (!data.organizationNumber?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['organizationNumber'],
          message: 'Enter the school organisation number.',
        });
      }
      if (!data.city?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['city'],
          message: 'Enter the school city.',
        });
      }
    }
    if (data.path === 'INSTRUCTOR') {
      if (data.licenseHeldYears === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['licenseHeldYears'],
          message: `Instructors must have held a licence for at least ${MIN_INSTRUCTOR_LICENSE_YEARS} years.`,
        });
      } else if (!isInstructorLicenseTenureEligible(data.licenseHeldYears)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['licenseHeldYears'],
          message: `Instructors must have held a licence for over ${MIN_INSTRUCTOR_LICENSE_YEARS - 1} years (minimum ${MIN_INSTRUCTOR_LICENSE_YEARS}).`,
        });
      }
      if (!data.city?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['city'],
          message: 'Enter the city you teach in.',
        });
      }
    }
  });
export type SignupStart = z.infer<typeof SignupStart>;

export const SignupComplete = z.object({
  next: z
    .string()
    .startsWith('/')
    .refine((value) => !value.startsWith('//'))
    .optional(),
});
export type SignupComplete = z.infer<typeof SignupComplete>;

export const SignupCompleteResponse = z.object({
  ok: z.literal(true),
  /** Canonical post-signup destination (preferred by the client). */
  next: z.string().startsWith('/'),
  /** Alias kept for older clients / tests. */
  to: z.string().startsWith('/'),
});
export type SignupCompleteResponse = z.infer<typeof SignupCompleteResponse>;
