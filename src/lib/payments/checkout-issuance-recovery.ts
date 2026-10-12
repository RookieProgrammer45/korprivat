import 'server-only';
import { prisma } from '@/lib/db';
import {
  checkoutIssuanceIdempotencyKey,
  isCheckoutIssuanceClaim,
  readCheckoutIssuanceParams,
} from '@/lib/payments/checkout-issuance';
import { getStripe } from '@/lib/payments/stripe';

/** Called by authenticated cancellation follow-up; never returns a payable URL. */
export async function recoverCancelledCheckoutIssuance(
  bookingId: string,
): Promise<'recovered' | 'pending'> {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || !booking.cancellationOutcome) return 'pending';
  const claim = booking.stripeSessionId ?? booking.stripeCheckoutSessionId;
  if (!claim || !isCheckoutIssuanceClaim(claim)) return 'recovered';
  const params = readCheckoutIssuanceParams(claim, bookingId);
  // Old opaque claims have no replay payload: do not guess or falsely report
  // them as reconciled. An operator must inspect those historical records.
  if (!params) return 'pending';
  const session = await getStripe().checkout.sessions.create(params, {
    idempotencyKey: checkoutIssuanceIdempotencyKey(bookingId, claim),
  });
  let saved: { count: number };
  try {
    saved = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        cancellationOutcome: booking.cancellationOutcome,
        stripeSessionId: booking.stripeSessionId,
        stripeCheckoutSessionId: booking.stripeCheckoutSessionId,
      },
      data: { stripeSessionId: session.id, stripeCheckoutSessionId: session.id },
    });
  } finally {
    // Never expose a recovered payable URL. A completed capture is reconciled
    // by the caller; a DB failure must not prevent best-effort expiration.
    if (session.status === 'open') {
      try {
        await getStripe().checkout.sessions.expire(session.id);
      } catch {
        /* caller retrieves authoritative capture state */
      }
    }
  }
  if (saved.count === 1) return 'recovered';
  const fresh = await prisma.booking.findUnique({ where: { id: bookingId } });
  return (fresh?.stripeSessionId ?? fresh?.stripeCheckoutSessionId) === session.id
    ? 'recovered'
    : 'pending';
}
