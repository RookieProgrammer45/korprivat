import { describe, expect, it } from 'vitest';
import { partialPayoutAfterRefund } from '@/lib/trust/disputes';

describe('partialPayoutAfterRefund (ADR-005)', () => {
  it('reduces payout by refunded SEK', () => {
    expect(partialPayoutAfterRefund({ payoutAmountSek: 450, refundSek: 200 })).toEqual({
      refundSek: 200,
      transferSek: 250,
    });
  });

  it('clamps transfer at zero', () => {
    expect(partialPayoutAfterRefund({ payoutAmountSek: 100, refundSek: 250 })).toEqual({
      refundSek: 250,
      transferSek: 0,
    });
  });
});
