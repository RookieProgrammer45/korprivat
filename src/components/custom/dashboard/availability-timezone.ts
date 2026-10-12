import type { AvailabilitySlotList } from '@/lib/contracts/availability';

// Owner list responses include `providerTimezone` even before the provider
// has published a slot. Older/public envelopes can still use a slot timezone.
export function availabilityTimezone(list: AvailabilitySlotList): string | undefined {
  return list.providerTimezone ?? list.items[0]?.timezone;
}
