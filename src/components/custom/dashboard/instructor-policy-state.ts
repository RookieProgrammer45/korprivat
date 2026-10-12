import type { CancellationTier } from '@/lib/business/cancellation-policy';

export function isInstructorPolicyDirty({
  selected,
  original,
  bookingMode,
  bookingModeOriginal,
}: {
  selected: CancellationTier;
  original: CancellationTier | null;
  bookingMode: 'instant' | 'request';
  bookingModeOriginal: 'instant' | 'request';
}): boolean {
  return selected !== original || bookingMode !== bookingModeOriginal;
}
