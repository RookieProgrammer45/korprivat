import 'server-only';
import { prisma } from '@/lib/db';
import {
  isCancellationPolicyEnforced,
  mapPaymentStatusToCanonical,
  reconcileCapturedPayment,
} from '@/lib/scheduling/booking-policy';

type PolicyDelegate = {
  findFirst: (args: unknown) => Promise<{ id: string } | null>;
  findMany?: (args: unknown) => Promise<{ listingId: string }[]>;
};

export async function listingHasActiveCancellationPolicy(listingId: string): Promise<boolean> {
  const policies = (prisma as unknown as { cancellationPolicy?: PolicyDelegate })
    .cancellationPolicy;
  if (!policies) return false;
  const row = await policies.findFirst({
    where: { listingId, state: 'active', approvedAt: { not: null } },
    select: { id: true },
  });
  return row != null;
}

export async function activePolicyListingIds(listingIds: string[]): Promise<Set<string>> {
  const policies = (prisma as unknown as { cancellationPolicy?: PolicyDelegate })
    .cancellationPolicy;
  if (!policies?.findMany || listingIds.length === 0) return new Set();
  const rows = await policies.findMany({
    where: { listingId: { in: listingIds }, state: 'active', approvedAt: { not: null } },
    select: { listingId: true },
  });
  return new Set(rows.map((row) => row.listingId));
}

export async function canonicalStateForBooking(
  bookingId: string,
  paymentStatus: string | null,
): Promise<ReturnType<typeof mapPaymentStatusToCanonical>> {
  const transitions = (
    prisma as unknown as {
      bookingStateTransition?: {
        findFirst: (args: unknown) => Promise<{ toState: string } | null>;
      };
    }
  ).bookingStateTransition;
  if (!transitions) return mapPaymentStatusToCanonical(paymentStatus);
  const latest = await transitions.findFirst({
    where: { bookingId },
    orderBy: { createdAt: 'desc' },
    select: { toState: true },
  });
  if (
    latest &&
    (latest.toState === 'pending' ||
      latest.toState === 'confirmed' ||
      latest.toState === 'in_progress' ||
      latest.toState === 'completed' ||
      latest.toState === 'cancelled' ||
      latest.toState === 'expired' ||
      latest.toState === 'no_show')
  ) {
    return latest.toState;
  }
  return mapPaymentStatusToCanonical(paymentStatus);
}

/** SC-15: an expired booking stays expired. Returns true when the capture was quarantined. */
export async function recordLateCaptureIfExpired(input: {
  bookingId: string;
  paymentStatus: string | null;
  stripeEventId: string;
  amountMinor: number | null;
}): Promise<boolean> {
  const canonical = await canonicalStateForBooking(input.bookingId, input.paymentStatus);
  const decision = reconcileCapturedPayment(canonical);
  if (decision.action !== 'late_captured') return false;
  const records = prisma as unknown as {
    paymentRecord?: { create: (args: unknown) => Promise<unknown> };
    opsTask?: { create: (args: unknown) => Promise<unknown> };
  };
  if (records.paymentRecord) {
    await records.paymentRecord.create({
      data: {
        bookingId: input.bookingId,
        state: 'captured',
        lateCaptured: true,
        amountMinor: input.amountMinor,
        currency: 'SEK',
        stripeEventId: input.stripeEventId,
      },
    });
  }
  if (records.opsTask) {
    await records.opsTask.create({
      data: {
        bookingId: input.bookingId,
        kind: 'late_captured',
        allowedActions: decision.opsActions,
        state: 'open',
      },
    });
  }
  return true;
}

export { isCancellationPolicyEnforced };
