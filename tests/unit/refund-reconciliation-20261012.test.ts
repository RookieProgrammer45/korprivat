import type Stripe from 'stripe';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  find: vi.fn(),
  update: vi.fn(),
  createRefund: vi.fn(),
  retrieveRefund: vi.fn(),
  retrieve: vi.fn(),
  email: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: { booking: { findUnique: m.find, updateMany: m.update } } }));
vi.mock('@/lib/payments/stripe', () => ({
  getStripe: () => ({
    refunds: { create: m.createRefund, retrieve: m.retrieveRefund },
    checkout: { sessions: { retrieve: m.retrieve } },
  }),
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: m.email }));

import { cancellationRefundAmountSek } from '@/lib/business/cancellation-policy';
import { reconcileCancelledCheckoutCapture } from '@/lib/payments/refunds';
import { handleChargeRefunded } from '@/lib/payments/stripe-webhook-handlers';

let refundedAt: Date | null;
const paidSession = {
  id: 'cs_saved',
  payment_status: 'paid',
  currency: 'sek',
  amount_total: 55000,
  payment_intent: 'pi_mock',
} as Stripe.Checkout.Session;
const input = {
  bookingId: 'booking',
  sessionId: 'cs_saved',
  grossChargedSek: 550,
  cancellationOutcome: 'cancelled_partial',
  cancellationPolicyTier: 'moderate',
  session: paidSession,
};
beforeEach(() => {
  vi.resetAllMocks();
  refundedAt = null;
  m.find.mockImplementation(async () => ({
    id: 'booking',
    studentName: 'Learner',
    studentEmail: 'learner@example.test',
    locale: 'en',
    grossChargedSek: 550,
    refundedAt,
  }));
  m.update.mockImplementation(async () => {
    const count = refundedAt ? 0 : 1;
    refundedAt = new Date();
    return { count };
  });
  m.createRefund.mockResolvedValue({ id: 're_mock' });
  m.retrieveRefund.mockResolvedValue({ id: 're_mock', status: 'succeeded' });
  m.email.mockResolvedValue({ id: 'mock' });
});

describe('cancelled capture reconciliation', () => {
  it('fully refunds a capture after pending cancellation exactly once, without retaining a policy fee', async () => {
    expect(
      (await reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true })).kind,
    ).toBe('refunded');
    expect(
      (await reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true })).kind,
    ).toBe('skipped');
    expect(m.createRefund).toHaveBeenCalledOnce();
    expect(m.createRefund).toHaveBeenCalledWith(
      { payment_intent: 'pi_mock', metadata: { bookingId: 'booking' } },
      { idempotencyKey: 'refund:booking:booking:full' },
    );
    expect(m.retrieveRefund).toHaveBeenCalledWith('re_mock');
    expect(m.email).toHaveBeenCalledOnce();
  });
  it('uses the frozen SEK policy refund when capture preceded cancellation', async () => {
    await reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: false });
    const amount = cancellationRefundAmountSek(550, 50);
    expect(m.createRefund).toHaveBeenCalledWith(
      { payment_intent: 'pi_mock', amount: amount * 100, metadata: { bookingId: 'booking' } },
      { idempotencyKey: `refund:booking:booking:sek-${amount}` },
    );
  });
  it('retries a successful Stripe refund after a DB failure with the same stable key', async () => {
    m.update.mockRejectedValueOnce(new Error('DB interrupted'));
    expect(
      (await reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true })).kind,
    ).toBe('error');
    expect(
      (await reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true })).kind,
    ).toBe('refunded');
    expect(m.createRefund.mock.calls[0]?.[1]).toEqual(m.createRefund.mock.calls[1]?.[1]);
  });
  it('does not settle or notify for a pending refund, then confirms the same refund on retry', async () => {
    m.createRefund.mockResolvedValue({ id: 're_pending' });
    m.retrieveRefund
      .mockResolvedValueOnce({ id: 're_pending', status: 'pending' })
      .mockResolvedValueOnce({ id: 're_pending', status: 'succeeded' });

    await expect(
      reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true }),
    ).resolves.toEqual({ kind: 'pending', refundId: 're_pending', amountSek: 550 });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.email).not.toHaveBeenCalled();

    await expect(
      reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true }),
    ).resolves.toEqual({ kind: 'refunded', refundId: 're_pending', amountSek: 550 });
    expect(m.createRefund).toHaveBeenCalledTimes(2);
    expect(m.createRefund.mock.calls[0]?.[1]).toEqual(m.createRefund.mock.calls[1]?.[1]);
    expect(m.retrieveRefund).toHaveBeenNthCalledWith(1, 're_pending');
    expect(m.retrieveRefund).toHaveBeenNthCalledWith(2, 're_pending');
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.email).toHaveBeenCalledOnce();
  });
  it.each(['failed', 'canceled'] as const)(
    'returns an explicit error and leaves a %s refund retryable',
    async (status) => {
      m.createRefund.mockResolvedValue({ id: `re_${status}` });
      m.retrieveRefund.mockResolvedValue({ id: `re_${status}`, status });

      await expect(
        reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true }),
      ).resolves.toEqual({ kind: 'error', message: `refund_${status}` });
      await expect(
        reconcileCancelledCheckoutCapture({ ...input, forceFullRefund: true }),
      ).resolves.toEqual({ kind: 'error', message: `refund_${status}` });

      expect(m.update).not.toHaveBeenCalled();
      expect(m.createRefund.mock.calls[0]?.[1]).toEqual(m.createRefund.mock.calls[1]?.[1]);
      expect(m.retrieveRefund).toHaveBeenCalledTimes(2);
    },
  );
  it('does not turn a cancelled policy outcome into refunded when charge.refunded arrives', async () => {
    await handleChargeRefunded({
      id: 'ch_mock',
      refunded: true,
      metadata: { bookingId: 'booking' },
    } as unknown as Stripe.Charge);
    expect(m.update.mock.calls[0]?.[0].data).not.toHaveProperty('paymentStatus');
    expect(m.update.mock.calls[0]?.[0].where.paymentStatus.in).toContain('cancelled_partial');
    expect(m.update.mock.calls[1]?.[0].where.paymentStatus.in).not.toContain('cancelled_partial');
  });
  it('does not mark an active booking fully refunded for a partial refund event', async () => {
    await handleChargeRefunded({
      id: 'ch_mock',
      refunded: false,
      metadata: { bookingId: 'booking' },
    } as unknown as Stripe.Charge);
    expect(m.update).toHaveBeenCalledOnce();
    expect(m.update.mock.calls[0]?.[0].data).not.toHaveProperty('paymentStatus');
  });
});
