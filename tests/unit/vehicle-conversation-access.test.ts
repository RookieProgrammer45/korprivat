import { describe, expect, it } from 'vitest';
import { canUseVehicleChat, vehiclePostDecision } from '@/lib/vehicle-sales/conversation-access';

describe('canUseVehicleChat', () => {
  it('requires a confirmed account', () => {
    expect(canUseVehicleChat(null)).toBe(false);
    expect(canUseVehicleChat({ emailVerified: false })).toBe(false);
    expect(canUseVehicleChat({ emailVerified: true })).toBe(true);
  });
});

describe('vehiclePostDecision', () => {
  it('lets a buyer open a thread and blocks the owner from messaging themselves', () => {
    expect(
      vehiclePostDecision({ userId: 'buyer', listingOwnerId: 'seller', conversation: null }),
    ).toBe('open');
    expect(
      vehiclePostDecision({ userId: 'seller', listingOwnerId: 'seller', conversation: null }),
    ).toBe('forbidden');
  });

  it('lets either participant reply and blocks everyone else', () => {
    const conversation = { id: 'c1', buyerUserId: 'buyer', sellerUserId: 'seller' };
    expect(vehiclePostDecision({ userId: 'seller', listingOwnerId: 'seller', conversation })).toBe(
      'reply',
    );
    expect(vehiclePostDecision({ userId: 'other', listingOwnerId: 'seller', conversation })).toBe(
      'forbidden',
    );
  });
});
