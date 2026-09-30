import type { ProviderRole } from '@/lib/business/provider-ownership';

export type BookingActor = 'learner' | 'provider';
export type BookingState =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'held_escrow'
  | 'awaiting_buyer_confirmation'
  | 'release_ready'
  | 'released'
  | 'disputed'
  | 'payout_pending'
  | 'payout_failed'
  | 'refunded'
  | 'awaiting_approval'
  | 'declined'
  | 'cancelled_early'
  | 'cancelled_late'
  | 'cancelled_full_refund'
  | 'cancelled_partial';

export type BookingCapabilities = {
  canAccept: boolean;
  canDecline: boolean;
  canCancel: boolean;
  /** Instructor: mark lesson delivered (held_escrow → awaiting_buyer_confirmation). */
  canComplete: boolean;
  /** Learner: confirm delivery (awaiting_buyer_confirmation → release_ready). */
  canConfirm: boolean;
  /** Learner: open escrow dispute before release. */
  canDisputeEscrow: boolean;
  nextStates: BookingState[];
};

const cancellationStates = new Set<BookingState>([
  'unpaid',
  'pending',
  'paid',
  'held_escrow',
  'awaiting_approval',
]);

export function bookingCapabilities(
  state: string | null | undefined,
  actor: BookingActor | null,
  providerRole: ProviderRole | null = null,
): BookingCapabilities {
  const current = state as BookingState;
  const providerCanAct = actor === 'provider' && providerRole !== null;
  const canAccept = providerCanAct && current === 'awaiting_approval';
  const canDecline = providerCanAct && current === 'awaiting_approval';
  const canCancel = actor !== null && cancellationStates.has(current);
  // Only the instructor marks delivered — buyer confirms via canConfirm.
  const canComplete = providerCanAct && current === 'held_escrow';
  const canConfirm = actor === 'learner' && current === 'awaiting_buyer_confirmation';
  const canDisputeEscrow = actor === 'learner' && current === 'awaiting_buyer_confirmation';
  const nextStates: BookingState[] = [];
  if (canAccept) nextStates.push('pending');
  if (canDecline) nextStates.push('declined');
  if (canCancel) nextStates.push('cancelled_full_refund');
  if (canComplete) nextStates.push('awaiting_buyer_confirmation');
  if (canConfirm) nextStates.push('release_ready');
  if (canDisputeEscrow) nextStates.push('disputed');
  return {
    canAccept,
    canDecline,
    canCancel,
    canComplete,
    canConfirm,
    canDisputeEscrow,
    nextStates,
  };
}

export function canTransition(
  from: string | null | undefined,
  to: BookingState,
  actor: BookingActor,
): boolean {
  if (to === 'declined' || to === 'pending')
    return actor === 'provider' && from === 'awaiting_approval';
  if (to === 'awaiting_buyer_confirmation')
    return actor === 'provider' && from === 'held_escrow';
  if (to === 'release_ready')
    return actor === 'learner' && from === 'awaiting_buyer_confirmation';
  if (to === 'disputed') return actor === 'learner' && from === 'awaiting_buyer_confirmation';
  if (to === 'released')
    return from === 'release_ready' || from === 'payout_pending' || from === 'payout_failed';
  if (to.startsWith('cancelled_'))
    return actor !== null && cancellationStates.has(from as BookingState);
  return false;
}

export function isTerminalBookingState(state: string | null | undefined): boolean {
  return (
    state === 'released' ||
    state === 'refunded' ||
    state === 'declined' ||
    state?.startsWith('cancelled_') === true
  );
}
