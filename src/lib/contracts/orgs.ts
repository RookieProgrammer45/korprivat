import { z } from 'zod';

/** Swedish organisation number: optional SE prefix, 10 digits with optional separators. */
export const SwedishOrganizationNumber = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .regex(/^(SE)?[\s-]?\d{6}[\s-]?\d{4}$/i, 'Invalid organisation number');

export const OrgRegisterRequest = z.object({
  name: z.string().trim().min(2).max(120),
  organizationNumber: SwedishOrganizationNumber,
  city: z.string().trim().max(80).optional(),
  address: z.string().trim().max(200).optional(),
  postcode: z.string().trim().max(20).optional(),
});
export type OrgRegisterRequest = z.infer<typeof OrgRegisterRequest>;

export const OrgRegisterResponse = z.object({
  organizationId: z.string().min(1),
  membershipId: z.string().min(1),
  slug: z.string().min(1),
});
export type OrgRegisterResponse = z.infer<typeof OrgRegisterResponse>;
