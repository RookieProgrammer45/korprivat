//
// POST /api/profile/picture returns { imageUrl, profileCompletedAt } on success.
// Both the route handler (server) and the SignUpForm's photo step (client)
// import this schema so the response shape is validated at runtime and any
// drift surfaces as a ZodError instead of silently propagating.
//
// Keep this file purely zod (no server-only imports) so it can travel to the
// client bundle without leaking server modules.
import { z } from 'zod';

export const PictureUploaded = z.object({
  imageUrl: z.string().url(),
  profileCompletedAt: z.string().datetime(),
});
export type PictureUploaded = z.infer<typeof PictureUploaded>;
