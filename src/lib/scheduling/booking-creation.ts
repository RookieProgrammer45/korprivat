// New reservations stay off in the directory-first release. Set
// BOOKING_CREATION_ENABLED=true only when booking is deliberately turned
// back on. Lifecycle routes for bookings that already exist do not use this.
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
