import { z } from 'zod';

export const ProviderActivationTrend = z.discriminatedUnion('status', [
  z.object({ status: z.literal('neutral') }),
  z.object({
    status: z.literal('confirmed'),
    direction: z.enum(['up', 'down', 'flat']),
    deltaPercent: z.number(),
  }),
]);

export const ProviderActivationResponse = z.object({
  activatedCount: z.number().int().nonnegative(),
  trend: ProviderActivationTrend,
});

export type ProviderActivationResponse = z.infer<typeof ProviderActivationResponse>;
