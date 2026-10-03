// Append-only Stripe webhook idempotency (Payments context).

import 'server-only';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';

export function hashStripePayload(rawBody: string): string {
  return createHash('sha256').update(rawBody).digest('hex');
}

/**
 * Claim an event id. Returns true if this delivery should process work;
 * false if already seen (idempotent ack).
 */
export async function claimStripeWebhookEvent(input: {
  eventId: string;
  eventType: string;
  payloadHash: string;
}): Promise<'claimed' | 'duplicate'> {
  try {
    await prisma.stripeWebhookEvent.create({
      data: {
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash: input.payloadHash,
      },
    });
    return 'claimed';
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: unknown }).code)
        : '';
    if (code === 'P2002') return 'duplicate';
    throw err;
  }
}
