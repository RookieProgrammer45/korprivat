//
// Shared zod schema for the early-access signup form. Safe to import from a
// 'use client' file: it has no server-only imports, so the client form
// reuses the input TYPE without pulling in the route handler or Prisma.

import { z } from 'zod';

export const WaitlistRole = z.enum(['STUDENT', 'INSTRUCTOR'], {
  required_error: 'Pick whether you are a student or an instructor.',
  invalid_type_error: 'Pick whether you are a student or an instructor.',
});

export type WaitlistRoleValue = z.infer<typeof WaitlistRole>;

export const WaitlistCreate = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Please tell us your name.')
    .max(120, 'Please keep it under 120 characters.'),
  email: z.string().trim().email('Please enter a valid email address.'),
  role: WaitlistRole,
});

export type WaitlistCreateInput = z.infer<typeof WaitlistCreate>;

export const WaitlistCreated = z.object({
  id: z.string(),
  role: WaitlistRole,
});

export type WaitlistCreatedValue = z.infer<typeof WaitlistCreated>;
