// Side-effect handlers for Stripe events beyond checkout.session.completed.
// Keep each handler idempotent against booking / connect state.

import 'server-only';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { OWNER_EMAIL } from '@/lib/ownership';
import type Stripe from 'stripe';

function alertRecipient(): string {
  return (
    process.env.EMAIL_OVERRIDE_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.OWNER_EMAIL?.trim() ||
    OWNER_EMAIL
  );
}

async function alertOps(subject: string, lines: string[]) {
  const { reportError } = await import('@/lib/observability/report-error');
  await reportError(new Error(subject), { tags: { area: 'stripe-webhook' }, extra: { lines } });
  try {
    const mail = notificationEmail({
      subject: `[DriveLinkUp] ${subject}`,
      title: subject,
      lines,
    });
    await sendEmail({ to: alertRecipient(), ...mail });
  } catch (err) {
    await reportError(err, { tags: { area: 'stripe-webhook', step: 'alert-email' } });
  }
}

async function findBookingByChargeOrPaymentIntent(ids: {
  chargeId?: string | null;
  paymentIntentId?: string | null;
  transferGroup?: string | null;
}) {
  if (ids.transferGroup) {
    const byId = await prisma.booking.findUnique({ where: { id: ids.transferGroup } });
    if (byId) return byId;
  }
  // Checkout metadata path: we store session id, not PI — fall back to transfer_group only.
  return null;
}

/** Stripe charge dispute opened — mark booking disputed if we can resolve it. */
export async function handleChargeDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
  const charge = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
  const pi =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  const booking = await findBookingByChargeOrPaymentIntent({
    chargeId: charge,
    paymentIntentId: pi,
  });

  // Prefer metadata on the dispute if Stripe carries bookingId (set on transfer_group).
  const metaBookingId = dispute.metadata?.bookingId;
  const target =
    booking ??
    (metaBookingId
      ? await prisma.booking.findUnique({ where: { id: metaBookingId } })
      : null);

  if (!target) {
    await alertOps('Stripe dispute with unmatched booking', [
      `Dispute ${dispute.id}`,
      `charge=${charge ?? 'n/a'} payment_intent=${pi ?? 'n/a'}`,
      'Manual match required in admin.',
    ]);
    return;
  }

  await prisma.booking.updateMany({
    where: {
      id: target.id,
      paymentStatus: { in: ['held_escrow', 'awaiting_buyer_confirmation', 'release_ready', 'released'] },
    },
    data: {
      paymentStatus: 'disputed',
      disputeStatus: 'open',
      disputeOpenedAt: new Date(),
    },
  });
  await alertOps('Stripe charge dispute opened', [
    `Booking ${target.id}`,
    `Dispute ${dispute.id} reason=${dispute.reason ?? 'unknown'}`,
  ]);
}

/** Platform refund landed — flip booking to refunded when still cancelable/held. */
export async function handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
  const bookingId = charge.metadata?.bookingId;
  if (!bookingId) {
    console.info('[stripe webhook] charge.refunded without bookingId metadata', {
      chargeId: charge.id,
    });
    return;
  }
  const now = new Date();
  const updated = await prisma.booking.updateMany({
    where: {
      id: bookingId,
      paymentStatus: {
        in: [
          'held_escrow',
          'awaiting_buyer_confirmation',
          'cancelled_full_refund',
          'cancelled_partial',
          'cancelled_late',
          'disputed',
        ],
      },
      refundedAt: null,
    },
    data: {
      paymentStatus: 'refunded',
      refundedAt: now,
    },
  });
  if (updated.count === 0) {
    console.info('[stripe webhook] charge.refunded no-op', { bookingId, chargeId: charge.id });
  }
}

/** Connect transfer failed — mark payout_failed and alert. */
export async function handleTransferFailed(transfer: Stripe.Transfer): Promise<void> {
  const bookingId = transfer.metadata?.bookingId ?? transfer.transfer_group;
  if (!bookingId) {
    await alertOps('transfer.failed unmatched', [`Transfer ${transfer.id}`]);
    return;
  }
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      paymentStatus: { in: ['release_ready', 'payout_pending', 'released'] },
      payoutReleasedAt: null,
    },
    data: { paymentStatus: 'payout_failed' },
  });
  // If already released with a PayoutRecord, still alert.
  await alertOps('Stripe transfer failed', [
    `Booking ${bookingId}`,
    `Transfer ${transfer.id}`,
    `destination=${typeof transfer.destination === 'string' ? transfer.destination : 'n/a'}`,
  ]);
}

/** Checkout abandoned/expired — clear pending session if still unpaid. */
export async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session,
): Promise<void> {
  const bookingId = session.metadata?.bookingId;
  if (!bookingId) return;
  await prisma.booking.updateMany({
    where: {
      id: bookingId,
      paymentStatus: 'pending',
      paidAt: null,
      OR: [{ stripeSessionId: session.id }, { stripeCheckoutSessionId: session.id }],
    },
    data: {
      paymentStatus: 'unpaid',
      stripeSessionId: null,
      stripeCheckoutSessionId: null,
    },
  });
}

/** Connect Express deauthorized — clear account flags on org or instructor. */
export async function handleAccountApplicationDeauthorized(
  accountId: string | null | undefined,
): Promise<void> {
  if (!accountId) return;

  const org = await prisma.organization.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    },
  });
  const instructor = await prisma.instructor.updateMany({
    where: { stripeAccountId: accountId },
    data: {
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    },
  });
  await alertOps('Connect account deauthorized', [
    `account=${accountId}`,
    `orgRows=${org.count} instructorRows=${instructor.count}`,
  ]);
}
