// @polsia:user-owned — shared signup state/start/complete contracts.
import { z } from 'zod';
import { PhotoVerificationState } from '@/lib/contracts/photo-verification';

export const SignupRole = z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE']);
export type SignupRole = z.infer<typeof SignupRole>;

export const SignupPrerequisite = z.enum(['photo', 'license', 'clickwrap', 'complete']);
export type SignupPrerequisite = z.infer<typeof SignupPrerequisite>;

export const SignupState = z.object({
  role: SignupRole,
  photo: PhotoVerificationState,
  nextPrerequisite: SignupPrerequisite,
});
export type SignupState = z.infer<typeof SignupState>;

export const SignupStart = z.object({ role: SignupRole });
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
  to: z.string().startsWith('/'),
});
export type SignupCompleteResponse = z.infer<typeof SignupCompleteResponse>;
