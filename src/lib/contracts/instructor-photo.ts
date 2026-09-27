import { z } from 'zod';

export const InstructorPhotoUploaded = z.object({
  imageUrl: z.string().url(),
});

export const InstructorPhotoError = z.union([
  z.object({
    error: z.object({ code: z.string(), message: z.string() }),
  }),
  z.object({
    errors: z.record(z.string(), z.string()),
  }),
]);

export const InstructorPhotoResponse = z.union([InstructorPhotoUploaded, InstructorPhotoError]);

export type InstructorPhotoUploaded = z.infer<typeof InstructorPhotoUploaded>;
