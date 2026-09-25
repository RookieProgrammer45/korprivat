// @polsia:user-owned — response contract for starting a resumable signup.
import { z } from 'zod';
import { SignupRole } from '@/lib/contracts/signup';

export const SignupStartResponse = z.object({
  role: SignupRole,
  startedAt: z.string().datetime(),
});
export type SignupStartResponse = z.infer<typeof SignupStartResponse>;
