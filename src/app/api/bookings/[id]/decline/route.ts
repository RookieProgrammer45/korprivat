// @polsia:user-owned — POST /api/bookings/[id]/decline
//
// "Instructor declined the Request-mode booking" terminal transition. Like
// the complete / cancel / dispute routes, authorised by the per-booking
// unguessable action token carried in the email deep-link.
//
// Reading the row is straightforward; we only flip
// `paymentStatus = 'declined'` and exit. No slot is reserved at this point
// (the slot stays open even after the original request submission; the
// instructor can reaffirm and the matching learner can re-submit a fresh
// row at a different preferredAt).
//
// Side effect: notify the *learner* with the row's terminal state. The
// instructor gets no further email on this path — they initiated the
// decline, the row clearly indicates it on the dashboard.
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingAccessToken } from '@/lib/business/booking-access';
import { assertTokenMatches } from '@/lib/business/escrow';
import { ProviderOwnershipError, resolveOwnedProvider } from '@/lib/business/provider-ownership';
import { formatProviderDate, providerTimezoneForCity } from '@/lib/business/provider-timezone';
import {
  BookingDeclineRequest,
  BookingDeclineResponse,
  type BookingPaymentStatus,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { bookingRequestDeclinedEmail } from '@/lib/email/templates';
import { getSessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingDeclineRequest.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }
  const data = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { city: true, name: true, userId: true },
  });
  const sessionUser = await getSessionUser();
  const suppliedToken = data.token ?? getBookingAccessToken(req);
  const tokenAuthorized =
    suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken);
  let sessionAuthorized = false;
  if (sessionUser) {
    try {
      const owned = await resolveOwnedProvider(sessionUser);
      sessionAuthorized = owned?.id === booking.instructorId;
    } catch (error) {
      if (error instanceof ProviderOwnershipError) {
        return NextResponse.json(
          { errors: { access: 'Provider ownership needs operator review.' } },
          { status: 409 },
        );
      }
      throw error;
    }
  }
  if (!tokenAuthorized && !sessionAuthorized) {
    return NextResponse.json({ errors: { token: 'Invalid action token' } }, { status: 403 });
  }
  // Already declined — short-circuit the idempotent response so the row
  // doesn't get re-flip churn.
  if (booking.paymentStatus === 'declined') {
    return NextResponse.json(
      BookingDeclineResponse.parse({
        id: booking.id,
        paymentStatus: 'declined' as BookingPaymentStatus,
      }),
      { status: 200 },
    );
  }
  // The decline only applies to a row still in flight; we don't accept a
  // decline on a row that's already settled (released / refunded) or
  // already cancelled by the learner.
  if (booking.paymentStatus !== 'awaiting_approval') {
    return NextResponse.json(
      {
        errors: {
          state: 'Row is not in awaiting-approval state — refresh before retrying.',
        },
      },
      { status: 409 },
    );
  }

  const now = new Date();
  const updateResult = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: 'awaiting_approval',
    },
    data: {
      paymentStatus: 'declined',
      declinedAt: now,
      declinedByLabel: data.declinedByLabel,
      declinedReason: data.reason ?? null,
    },
  });

  if (updateResult.count === 0) {
    // Race lost — re-read and return the current state.
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json(
      BookingDeclineResponse.parse({
        id: booking.id,
        paymentStatus: (fresh?.paymentStatus ?? 'declined') as BookingPaymentStatus,
      }),
      { status: 200 },
    );
  }

  // Look up the instructor for the email — we don't need any rates here,
  // just the human-readable name. Failure is fine (the row is committed
  // and the platform can recover from a missed mail).
  const preferredAtLocal = instructor
    ? formatProviderDate(
        booking.preferredAt,
        booking.locale === 'en' ? 'en' : 'sv',
        providerTimezoneForCity(instructor.city),
      )
    : booking.preferredAt.toISOString().slice(0, 16);
  const learnerMail = bookingRequestDeclinedEmail({
    recipientName: booking.studentName,
    instructorName: instructor?.name ?? 'your instructor',
    category: booking.category,
    preferredAtLocal,
    bookingId: booking.id,
    reason: data.reason ?? undefined,
    locale: booking.locale === 'en' ? 'en' : 'sv',
  });
  if (booking.studentEmail) {
    sendEmail({ to: booking.studentEmail, ...learnerMail }).catch(() => undefined);
  }

  return NextResponse.json(
    BookingDeclineResponse.parse({
      id: booking.id,
      paymentStatus: 'declined' as BookingPaymentStatus,
    }),
    { status: 200 },
  );
}
