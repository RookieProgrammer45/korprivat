// Resolve whether the caller is the learner or the instructor for a booking.
// Shared by deliver / confirm / dispute-escrow routes.

import { getBookingAccessToken, matchesLearnerAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import { getSessionUser } from '@/lib/require-auth';

export type BookingActorRole = 'learner' | 'instructor';

export type BookingActorContext = {
  role: BookingActorRole;
  sessionUserId: string | null;
  via: 'session' | 'token';
};

export async function resolveBookingActor(input: {
  req: Request;
  booking: {
    userId: string | null;
    studentEmail: string;
    learnerAccessTokenHash: string | null;
    actionToken: string | null;
  };
  instructorUserId: string | null | undefined;
  bodyToken?: string | null;
}): Promise<BookingActorContext | null> {
  const sessionUser = await getSessionUser();
  const suppliedToken = input.bodyToken ?? getBookingAccessToken(input.req);
  const learnerToken = matchesLearnerAccessToken(
    input.booking.learnerAccessTokenHash,
    suppliedToken,
  );
  const providerToken =
    suppliedToken != null && assertTokenMatches(input.booking.actionToken, suppliedToken);
  const learnerSession =
    sessionUser != null &&
    (input.booking.userId === sessionUser.id ||
      input.booking.studentEmail.trim().toLowerCase() === sessionUser.email.trim().toLowerCase());
  const providerSession = sessionUser != null && input.instructorUserId === sessionUser.id;

  if (providerSession || providerToken) {
    return {
      role: 'instructor',
      sessionUserId: sessionUser?.id ?? null,
      via: providerSession ? 'session' : 'token',
    };
  }
  if (learnerSession || learnerToken) {
    return {
      role: 'learner',
      sessionUserId: sessionUser?.id ?? null,
      via: learnerSession ? 'session' : 'token',
    };
  }
  return null;
}

export const AUTO_RELEASE_HOURS = 48;

export function autoReleaseAtFrom(now: Date = new Date()): Date {
  return new Date(now.getTime() + AUTO_RELEASE_HOURS * 60 * 60 * 1000);
}
