// @polsia:user-owned — client-safe bearer-header helper for booking deep links.

export function bookingAccessHeaders(token: string | undefined): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
