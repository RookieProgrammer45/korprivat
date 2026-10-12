import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  instructor: vi.fn(),
  receiptFind: vi.fn(),
  fee: vi.fn(),
  free: vi.fn(),
  reconcile: vi.fn(),
  expire: vi.fn(),
  email: vi.fn(),
  repair: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => {
  const db = {
    booking: { findUnique: m.find, updateMany: m.update },
    instructor: { findUnique: m.instructor },
    bookingReceipt: { findMany: m.receiptFind },
    lateCancellationFee: { create: m.fee },
    availabilitySlot: { updateMany: m.free },
  };
  return {
    prisma: { ...db, $transaction: async (cb: (tx: typeof db) => Promise<unknown>) => cb(db) },
  };
});
vi.mock('@/lib/require-auth', () => ({
  getSessionUser: async () => ({ id: 'learner', email: 'learner@example.test' }),
}));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { expire: m.expire } } }),
}));
vi.mock('@/lib/payments/refunds', () => ({
  reconcileCancelledCheckoutCapture: m.reconcile,
  alertReleasedCancelNeedsReview: vi.fn(),
}));
vi.mock('@/lib/business/receipts', () => ({ repairPaidCancellationReceipts: m.repair }));
vi.mock('@/lib/email/send', () => ({ sendEmail: m.email }));

import { POST } from '@/app/api/bookings/[id]/cancel/route';
import { computeCancellationFeeSek } from '@/lib/business/cancellation-policy';

function booking() {
  return {
    id: 'booking',
    instructorId: 'provider',
    userId: 'learner',
    studentName: 'Learner',
    studentEmail: 'learner@example.test',
    preferredAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    paymentStatus: 'pending',
    paidAt: null,
    heldAt: null,
    cancellationOutcome: null,
    cancelledAt: null,
    actionToken: null,
    learnerAccessTokenHash: null,
    grossChargedSek: 550,
    priceAmountSek: 550,
    serviceFeeSek: 0,
    cancellationPolicyTier: 'moderate',
    locale: 'en',
    stripeSessionId: 'cs_saved',
    stripeCheckoutSessionId: 'cs_saved',
  };
}
function request() {
  return new Request('https://www.drivelinkup.com/api/bookings/booking/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cancelledByLabel: 'Learner' }),
  });
}
const ctx = () => ({ params: Promise.resolve({ id: 'booking' }) });
beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue(booking());
  m.instructor.mockResolvedValue({
    userId: 'provider-user',
    providerRole: 'INSTRUCTOR',
    name: 'Provider',
    city: 'Stockholm',
    hourlyRateSek: 999,
    email: null,
  });
  m.receiptFind.mockResolvedValue([]);
  m.update.mockResolvedValue({ count: 1 });
  m.free.mockResolvedValue({ count: 1 });
  m.expire.mockResolvedValue({ status: 'expired' });
  m.reconcile.mockResolvedValue({ kind: 'refunded', refundId: 're_mock', amountSek: 550 });
  m.email.mockResolvedValue({ id: 'mock' });
  m.repair.mockResolvedValue(false);
});
describe('cancellation interleavings', () => {
  it('withdraws pending saved checkout without fee, then fully reconciles a capture which beats expiration', async () => {
    const res = await POST(request(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      cancellationOutcome: 'cancelled_partial',
      feeAmountSek: 0,
    });
    expect(m.expire).toHaveBeenCalledWith('cs_saved');
    expect(m.reconcile).toHaveBeenCalledOnce();
    expect(m.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({ forceFullRefund: true, grossChargedSek: 550 }),
    );
    expect(m.fee).not.toHaveBeenCalled();
    expect(m.repair).not.toHaveBeenCalled();
    expect(m.free).toHaveBeenCalledOnce();
  });
  it('retries after capture wins the first CAS and uses the immutable booked charge, never the new profile rate', async () => {
    const pending = booking();
    const captured = {
      ...pending,
      paymentStatus: 'held_escrow',
      paidAt: new Date(),
      heldAt: new Date(),
    };
    m.find.mockResolvedValueOnce(pending).mockResolvedValueOnce(captured);
    m.update.mockResolvedValueOnce({ count: 0 }).mockResolvedValueOnce({ count: 1 });
    const res = await POST(request(), ctx());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      cancellationOutcome: 'cancelled_partial',
      feeAmountSek: computeCancellationFeeSek(550, 50),
    });
    expect(m.update).toHaveBeenCalledTimes(2);
    expect(m.fee).toHaveBeenCalledOnce();
    expect(m.fee).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountSek: 275 }) }),
    );
    expect(m.free).toHaveBeenCalledOnce();
    expect(m.reconcile).toHaveBeenCalledOnce();
    expect(m.reconcile).toHaveBeenCalledWith(
      expect.objectContaining({
        forceFullRefund: false,
        grossChargedSek: 550,
        cancellationPolicyTier: 'moderate',
      }),
    );
  });
  it('returns pending reconciliation instead of falsely reporting a completed refund after an outage', async () => {
    m.reconcile.mockResolvedValueOnce({ kind: 'error', message: 'temporary Stripe outage' });
    const res = await POST(request(), ctx());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({
      cancellationOutcome: 'cancelled_partial',
      feeAmountSek: 0,
    });
  });
  it('cancels an in-flight issuance claim without trying to expire the claim as a Stripe session', async () => {
    const row = {
      ...booking(),
      stripeSessionId: null,
      stripeCheckoutSessionId: 'dlu_checkout_pending-claim',
    };
    m.find.mockImplementation(async () => ({ ...row }));
    m.update.mockImplementation(async ({ data }) => {
      Object.assign(row, data);
      return { count: 1 };
    });
    const res = await POST(request(), ctx());
    expect(res.status).toBe(202);
    expect(await res.json()).toMatchObject({ reconciliationPending: true });
    expect(m.expire).not.toHaveBeenCalled();
    expect(m.reconcile).not.toHaveBeenCalled();
    expect(m.free).toHaveBeenCalledOnce();
  });
});
