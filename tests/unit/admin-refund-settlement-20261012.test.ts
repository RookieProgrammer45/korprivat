import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ find: vi.fn(), update: vi.fn(), refund: vi.fn(), payout: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: async () => ({ user: { id: 'admin', role: 'admin' } }) } },
}));
vi.mock('@/lib/db', () => ({ prisma: { booking: { findUnique: m.find, update: m.update } } }));
vi.mock('@/lib/payments/refunds', () => ({ refundBooking: m.refund }));
vi.mock('@/lib/payments/payouts', () => ({ payoutBooking: m.payout }));

import { POST } from '@/app/api/admin/bookings/[id]/resolve-dispute/route';

beforeEach(() => {
  vi.resetAllMocks();
  m.find.mockResolvedValue({ id: 'b', paymentStatus: 'disputed', payoutAmountSek: 495 });
});
describe('operator refund settlement boundary', () => {
  it.each(['refund', 'partial'] as const)(
    'does not resolve %s while the provider refund is pending',
    async (outcome) => {
      m.refund.mockResolvedValue({ kind: 'pending', refundId: 're_pending', amountSek: 100 });
      const response = await POST(
        new Request('https://www.drivelinkup.com/api/admin/bookings/b/resolve-dispute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ outcome, note: 'Customer refund review', amountSek: 100 }),
        }),
        { params: Promise.resolve({ id: 'b' }) },
      );
      expect(response.status).toBe(503);
      expect(await response.json()).toMatchObject({
        error: 'refund_pending',
        reconciliationPending: true,
      });
      expect(m.update).not.toHaveBeenCalled();
      expect(m.payout).not.toHaveBeenCalled();
    },
  );
  it('does not label a charge refunded when its evidence is missing', async () => {
    m.refund.mockResolvedValue({ kind: 'skipped', reason: 'no_session' });
    const response = await POST(
      new Request('https://www.drivelinkup.com/api/admin/bookings/b/resolve-dispute', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outcome: 'refund', note: 'Missing evidence review' }),
      }),
      { params: Promise.resolve({ id: 'b' }) },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'refund_missing_evidence' });
    expect(m.update).not.toHaveBeenCalled();
  });
});
