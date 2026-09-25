// @polsia:user-owned — canonical booking actor capabilities and transitions.
import type { ProviderRole } from '@/lib/business/provider-ownership';

export type BookingActor = 'learner' | 'provider';
export type BookingState =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'held_escrow'
  | 'released'
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
  canComplete: boolean;
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
  const canComplete = actor !== null && current === 'held_escrow';
  const nextStates: BookingState[] = [];
  if (canAccept) nextStates.push('pending');
  if (canDecline) nextStates.push('declined');
  if (canCancel) nextStates.push('cancelled_full_refund');
  if (canComplete) nextStates.push('released');
  return { canAccept, canDecline, canCancel, canComplete, nextStates };
}

export function canTransition(
  from: string | null | undefined,
  to: BookingState,
  actor: BookingActor,
): boolean {
  if (to === 'declined' || to === 'pending')
    return actor === 'provider' && from === 'awaiting_approval';
  if (to === 'released') return from === 'held_escrow';
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
