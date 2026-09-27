import { z } from 'zod';

export const PhotoStatus = z.enum(['NONE', 'STAGED', 'CONFIRMED']);
export type PhotoStatus = z.infer<typeof PhotoStatus>;

export const PhotoUploadResponse = z.object({
  imageUrl: z.string().url(),
  stagedAt: z.string().datetime(),
  status: z.literal('STAGED'),
});
export type PhotoUploadResponse = z.infer<typeof PhotoUploadResponse>;

export const PhotoConfirmationResponse = z.object({
  imageUrl: z.string().url(),
  confirmedAt: z.string().datetime(),
  profileCompletedAt: z.string().datetime(),
  status: z.literal('CONFIRMED'),
});
export type PhotoConfirmationResponse = z.infer<typeof PhotoConfirmationResponse>;

export const PhotoVerificationState = z.object({
  status: PhotoStatus,
  imageUrl: z.string().url().nullable(),
  confirmedAt: z.string().datetime().nullable(),
});
export type PhotoVerificationState = z.infer<typeof PhotoVerificationState>;
