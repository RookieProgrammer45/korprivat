// Stripe Connect Transfer on lesson completion.
// Destination: Organization Connect account when booking.organizationId is set,
// otherwise the Instructor Connect account. Commission via instructorPayoutSek.

import 'server-only';
import { instructorPayoutSek } from '@/lib/business/booking-fees';
import { syncBookingReceiptStatuses } from '@/lib/business/receipts';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { notificationEmail } from '@/lib/email/templates';
import { getStripe } from '@/lib/payments/stripe';
import { OWNER_EMAIL } from '@/lib/ownership';

export type PayoutResult =
  | { kind: 'sent'; transferId: string; amountSek: number; recipientType: string }
  | { kind: 'duplicate'; transferId: string }
  | {
      kind: 'skipped';
      reason:
        | 'no_connect'
        | 'payouts_disabled'
        | 'not_ready'
        | 'not_held'
        | 'missing_booking'
        | 'disputed';
    }
  | { kind: 'error'; message: string };

const PAYOUT_READY_STATES = new Set(['release_ready', 'payout_pending', 'payout_failed']);

export type PayoutActor = {
  completedByRole: 'learner' | 'instructor';
  completedByLabel: string;
};

function alertRecipient(): string {
  return (
    process.env.EMAIL_OVERRIDE_TO?.trim() ||
    process.env.CONTACT_EMAIL?.trim() ||
    process.env.OWNER_EMAIL?.trim() ||
    OWNER_EMAIL
  );
}

async function alertOps(subject: string, lines: string[]) {
  console.error(`[payouts] ${subject}`, { lines });
  try {
    const mail = notificationEmail({
      subject: `[DriveLinkUp] ${subject}`,
      title: subject,
      lines,
    });
    await sendEmail({ to: alertRecipient(), ...mail });
  } catch (err) {
    console.error('[payouts] alert email failed', err);
  }
}

export async function payoutBooking(
  bookingId: string,
  actor?: PayoutActor,
): Promise<PayoutResult> {
  const existing = await prisma.payoutRecord.findUnique({ where: { bookingId } });
  if (existing) {
    return { kind: 'duplicate', transferId: existing.transferId };
  }

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    return { kind: 'skipped', reason: 'missing_booking' };
  }
  if (booking.paymentStatus === 'disputed') {
    return { kind: 'skipped', reason: 'disputed' };
  }
  if (!booking.paymentStatus || !PAYOUT_READY_STATES.has(booking.paymentStatus)) {
    return { kind: 'skipped', reason: 'not_ready' };
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: {
      id: true,
      hourlyRateSek: true,
      stripeAccountId: true,
      payoutsEnabled: true,
      name: true,
      email: true,
    },
  });
  if (!instructor) {
    return { kind: 'skipped', reason: 'missing_booking' };
  }

  let destinationAccountId: string | null = null;
  let recipientType: 'INSTRUCTOR' | 'ORGANIZATION' = 'INSTRUCTOR';
  let recipientId = instructor.id;
  let payoutsEnabled = false;

  if (booking.organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: booking.organizationId },
      select: {
        id: true,
        stripeAccountId: true,
        payoutsEnabled: true,
        name: true,
      },
    });
    if (!org?.stripeAccountId) {
      await prisma.booking.updateMany({
        where: { id: bookingId, paymentStatus: { in: [...PAYOUT_READY_STATES] } },
        data: { paymentStatus: 'payout_pending' },
      });
      await alertOps('Payout skipped — school Connect missing', [
        `Booking ${bookingId} is school-affiliated but Organization ${booking.organizationId} has no Stripe Connect account.`,
        'Funds remain in payout_pending. Complete Connect onboarding, then retry via admin.',
      ]);
      return { kind: 'skipped', reason: 'no_connect' };
    }
    if (!org.payoutsEnabled) {
      await prisma.booking.updateMany({
        where: { id: bookingId, paymentStatus: { in: [...PAYOUT_READY_STATES] } },
        data: { paymentStatus: 'payout_pending' },
      });
      await alertOps('Payout skipped — school payouts disabled', [
        `Booking ${bookingId}: Organization ${org.id} Connect account exists but payoutsEnabled=false.`,
        'Funds remain in payout_pending.',
      ]);
      return { kind: 'skipped', reason: 'payouts_disabled' };
    }
    destinationAccountId = org.stripeAccountId;
    recipientType = 'ORGANIZATION';
    recipientId = org.id;
    payoutsEnabled = true;
  } else {
    if (!instructor.stripeAccountId) {
      await prisma.booking.updateMany({
        where: { id: bookingId, paymentStatus: { in: [...PAYOUT_READY_STATES] } },
        data: { paymentStatus: 'payout_pending' },
      });
      await alertOps('Payout skipped — instructor Connect missing', [
        `Booking ${bookingId}: Instructor ${instructor.id} has no Stripe Connect account.`,
        'Funds remain in payout_pending. Instructor must finish Connect onboarding, then retry.',
      ]);
      return { kind: 'skipped', reason: 'no_connect' };
    }
    if (!instructor.payoutsEnabled) {
      await prisma.booking.updateMany({
        where: { id: bookingId, paymentStatus: { in: [...PAYOUT_READY_STATES] } },
        data: { paymentStatus: 'payout_pending' },
      });
      await alertOps('Payout skipped — instructor payouts disabled', [
        `Booking ${bookingId}: Instructor ${instructor.id} Connect account exists but payoutsEnabled=false.`,
        'Funds remain in payout_pending.',
      ]);
      return { kind: 'skipped', reason: 'payouts_disabled' };
    }
    destinationAccountId = instructor.stripeAccountId;
    recipientType = 'INSTRUCTOR';
    recipientId = instructor.id;
    payoutsEnabled = true;
  }

  if (!destinationAccountId || !payoutsEnabled) {
    return { kind: 'skipped', reason: 'no_connect' };
  }

  // Prefer frozen payoutAmountSek stamped at charge/complete; else recompute
  // from priceAmountSek snapshot only — never fall back to live hourlyRateSek
  // (rate drift between book and payout is a known money bug).
  let payoutSek = booking.payoutAmountSek;
  if (payoutSek == null) {
    if (booking.priceAmountSek == null) {
      await alertOps('Payout blocked — missing fee snapshot', [
        `Booking ${bookingId} has neither payoutAmountSek nor priceAmountSek.`,
        'Refuse live-rate fallback. Reconcile manually.',
      ]);
      return { kind: 'error', message: 'missing_fee_snapshot' };
    }
    payoutSek = instructorPayoutSek(booking.priceAmountSek, {
      organizationId: booking.organizationId,
    }).payoutSek;
  }
  const fees = {
    payoutSek,
    priceSek: booking.priceAmountSek ?? payoutSek,
  };
  const amountOre = fees.payoutSek * 100;

  if (amountOre <= 0) {
    return { kind: 'error', message: 'invalid_payout_amount' };
  }

  try {
    const stripe = getStripe();
    // Stripe caches failed transfer responses under the same idempotency key
    // for ~24h. A sticky `transfer:booking:{id}` key blocks admin retry after
    // balance_insufficient once the platform balance is topped up.
    // Include paymentStatus so release_ready races still dedupe, while
    // payout_failed / payout_pending retries get a fresh key.
    const idempotencyKey = `transfer:booking:${bookingId}:${booking.paymentStatus ?? 'ready'}`;
    const transfer = await stripe.transfers.create(
      {
        amount: amountOre,
        currency: 'sek',
        destination: destinationAccountId,
        transfer_group: bookingId,
        metadata: {
          bookingId,
          recipientType,
          recipientId,
        },
      },
      { idempotencyKey },
    );

    const now = new Date();
    const completedByRole = actor?.completedByRole ?? 'instructor';
    const completedByLabel = actor?.completedByLabel ?? 'system';

    const claimed = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        paymentStatus: { in: ['release_ready', 'payout_pending', 'payout_failed'] },
        payoutReleasedAt: null,
      },
      data: {
        completedAt: now,
        completedByRole,
        completedByLabel,
        payoutReleasedAt: now,
        releasedByRole: completedByRole,
        releasedByLabel: completedByLabel,
        paymentStatus: 'released',
        payoutAmountSek: fees.payoutSek,
      },
    });

    if (claimed.count === 0) {
      // Race: another worker released, or state changed. Transfer may exist —
      // still write PayoutRecord if missing for audit.
      const freshRecord = await prisma.payoutRecord.findUnique({ where: { bookingId } });
      if (freshRecord) {
        return { kind: 'duplicate', transferId: freshRecord.transferId };
      }
    }

    await prisma.payoutRecord.create({
      data: {
        bookingId,
        transferId: transfer.id,
        recipientType,
        recipientId,
        amountSek: fees.payoutSek,
        currency: 'SEK',
        status: 'sent',
      },
    });

    await syncBookingReceiptStatuses(bookingId, 'released', 'released').catch((err) => {
      console.error('[payouts] receipt sync failed', err);
    });

    // Payout notification — best-effort after successful transfer.
    try {
      const locale = booking.locale === 'en' ? 'en' : 'sv';
      const { payoutNotificationEmail } = await import('@/lib/email/payout-notification');
      if (recipientType === 'ORGANIZATION') {
        const org = await prisma.organization.findUnique({
          where: { id: recipientId },
          select: { name: true, contactEmail: true },
        });
        if (org?.contactEmail) {
          const mail = payoutNotificationEmail({
            locale,
            recipientName: org.name,
            amountSek: fees.payoutSek,
            bookingId,
            learnerName: booking.studentName,
          });
          await sendEmail({ to: org.contactEmail, ...mail });
        }
      } else if (instructor.email) {
        const mail = payoutNotificationEmail({
          locale,
          recipientName: instructor.name,
          amountSek: fees.payoutSek,
          bookingId,
          learnerName: booking.studentName,
        });
        await sendEmail({ to: instructor.email, ...mail });
      }
    } catch (err) {
      console.error('[payouts] payout notification email failed', err);
    }

    return {
      kind: 'sent',
      transferId: transfer.id,
      amountSek: fees.payoutSek,
      recipientType,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'transfer_failed';
    console.error('[payouts] transfer failed', { bookingId, message });
    await prisma.booking.updateMany({
      where: { id: bookingId, paymentStatus: { in: [...PAYOUT_READY_STATES] } },
      data: { paymentStatus: 'payout_failed' },
    });
    await alertOps('Payout transfer failed', [
      `Booking ${bookingId}: Stripe transfer failed.`,
      message,
      'Funds remain in payout_failed. Retry via admin after investigating.',
    ]);
    return { kind: 'error', message };
  }
}
