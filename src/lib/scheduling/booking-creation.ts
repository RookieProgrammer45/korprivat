// The booking API stays in the repo for a later phase. Turn this on only
// when the directory has shown demand AND schools use booking systems this
// API can connect to. Neither is true yet, so production leaves
// BOOKING_CREATION_ENABLED unset. Do not delete the booking routes because
// this returns false. Cancel, refund, dispute, and receipt do not use it.
// Age verification (claimed DOB + Didit) ships with that same global booking
// flip — not with directory signup.
export function newBookingCreationEnabled(): boolean {
  return process.env.BOOKING_CREATION_ENABLED === 'true';
}

/** What the public directory may say. Closed creation never advertises a booking mode. */
export function publishedBookingMode(
  stored: string | null | undefined,
): 'instant' | 'request' | 'contact' {
  if (!newBookingCreationEnabled()) return 'contact';
  if (stored === 'request' || stored === 'contact') return stored;
  return 'instant';
}
