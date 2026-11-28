export function canUseVehicleChat(user: { emailVerified: boolean } | null): boolean {
  return user?.emailVerified === true;
}

export type VehiclePostDecision = 'open' | 'reply' | 'forbidden';

export function vehiclePostDecision(input: {
  userId: string;
  listingOwnerId: string;
  conversation: { id: string; buyerUserId: string; sellerUserId: string } | null;
}): VehiclePostDecision {
  const conversation = input.conversation;
  if (conversation) {
    const party =
      input.userId === conversation.buyerUserId || input.userId === conversation.sellerUserId;
    if (!party) return 'forbidden';
    if (conversation.sellerUserId !== input.listingOwnerId) return 'forbidden';
    if (conversation.buyerUserId === input.listingOwnerId) return 'forbidden';
    return 'reply';
  }
  if (input.userId === input.listingOwnerId) return 'forbidden';
  return 'open';
}
