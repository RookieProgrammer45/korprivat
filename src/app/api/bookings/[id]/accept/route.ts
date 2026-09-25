// @polsia:user-owned — POST /api/bookings/[id]/accept.
// An instructor can accept through the emailed action token or a signed-in
// session linked to the instructor profile. Checkout uses the amount already
// stamped on the booking, never the current browser or profile value.
import 'server-only';
import { NextResponse } from 'next/server';
import { generateLearnerAccessToken } from '@/lib/business/booking-access';
import { learnerTotalSek } from '@/lib/business/booking-fees';
import { assertTokenMatches, generateBookingToken } from '@/lib/business/escrow';
import { ProviderOwnershipError, resolveOwnedProvider } from '@/lib/business/provider-ownership';
import { formatProviderDate, providerTimezoneForCity } from '@/lib/business/provider-timezone';
import {
  BookingAcceptRequest,
  BookingAcceptResponse,
  type BookingPaymentStatus,
  BookingPaymentStatusEnum,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import {
  bookingRequestApprovedEmail,
  bookingRequestApprovedInstructorCopyEmail,
} from '@/lib/email/templates';
import { sekToUsdChargeAmount } from '@/lib/payments/format-amount';
import { resolveOrigin } from '@/lib/payments/origin';
import { getSessionUser } from '@/lib/require-auth';
import {
  createCheckoutSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/client';

export const dynamic = 'force-dynamic';

type PaymentLinkError = 'not_enabled' | 'not_onboarded' | 'unknown';

function safeStatus(value: string | null | undefined): BookingPaymentStatus {
  return BookingPaymentStatusEnum.options.includes(value as BookingPaymentStatus)
    ? (value as BookingPaymentStatus)
    : 'unpaid';
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = BookingAcceptRequest.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) errors[field] = message;
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ errors: { id: 'Booking not found' } }, { status: 404 });
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, name: true, email: true, city: true, userId: true, hourlyRateSek: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { id: 'Instructor not found' } }, { status: 404 });
  }

  const suppliedToken = parsed.data.token ?? getTokenFromRequest(req);
  const sessionUser = await getSessionUser();
  const tokenAuthorized =
    suppliedToken != null && assertTokenMatches(booking.actionToken, suppliedToken);
  let sessionAuthorized = false;
  if (sessionUser) {
    try {
      const owned = await resolveOwnedProvider(sessionUser);
      sessionAuthorized = owned?.id === instructor.id;
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
    return NextResponse.json(
      { errors: { access: 'Booking access is invalid or expired' } },
      { status: 403 },
    );
  }

  const currentStatus = safeStatus(booking.paymentStatus);
  if (currentStatus !== 'awaiting_approval') {
    return NextResponse.json(
      BookingAcceptResponse.parse({
        id: booking.id,
        paymentStatus: currentStatus,
        actionUrl: null,
      }),
      { status: 200 },
    );
  }
  if (!booking.slotId) {
    return NextResponse.json(
      { errors: { slot: 'This request has no reservable lesson slot' } },
      { status: 409 },
    );
  }

  const reserved = await prisma.availabilitySlot.updateMany({
    where: {
      id: booking.slotId,
      instructorId: booking.instructorId,
      startsAt: { gt: new Date() },
      bookedAt: null,
    },
    data: { bookedAt: new Date(), bookedBookingId: booking.id },
  });
  if (reserved.count !== 1) {
    return NextResponse.json(
      {
        errors: {
          slot: 'Another learner has taken this slot — decline the request to release it.',
        },
      },
      { status: 409 },
    );
  }

  const totals =
    booking.priceAmountSek != null &&
    booking.serviceFeeSek != null &&
    booking.grossChargedSek != null
      ? {
          priceSek: booking.priceAmountSek,
          serviceFeeSek: booking.serviceFeeSek,
          totalSek: booking.grossChargedSek,
        }
      : learnerTotalSek(instructor.hourlyRateSek);
  const learnerAccess = generateLearnerAccessToken();
  const escrowActionToken = generateBookingToken();
  const origin = resolveOrigin(req);
  const detailUrl = `${origin}/bookings/${encodeURIComponent(booking.id)}?token=${encodeURIComponent(learnerAccess.token)}`;

  let checkout: { stripeSessionId: string; url: string };
  try {
    checkout = await createCheckoutSession({
      amountUsd: sekToUsdChargeAmount(totals.totalSek),
      name: `Betala lektionen — ${instructor.name}`,
      successUrl: detailUrl,
      cancelUrl: detailUrl,
      metadata: {
        bookingId: booking.id,
        priceSek: String(totals.priceSek),
        serviceFeeSek: String(totals.serviceFeeSek),
        grossChargedSek: String(totals.totalSek),
      },
    });
  } catch (error) {
    await releaseSlot(booking.id);
    const code = classifyStripeError(error);
    const status = code === 'not_enabled' ? 403 : code === 'not_onboarded' ? 409 : 500;
    return NextResponse.json({ errors: { payments: code } }, { status });
  }

  const updated = await prisma.booking.updateMany({
    where: { id: booking.id, paymentStatus: 'awaiting_approval' },
    data: {
      paymentStatus: 'pending',
      stripeCheckoutSessionId: checkout.stripeSessionId,
      actionToken: escrowActionToken,
      learnerAccessTokenHash: learnerAccess.tokenHash,
      acceptedByLabel: parsed.data.acceptedByLabel,
      acceptedAt: new Date(),
      priceAmountSek: totals.priceSek,
      serviceFeeSek: totals.serviceFeeSek,
      grossChargedSek: totals.totalSek,
    },
  });
  if (updated.count !== 1) {
    await releaseSlot(booking.id);
    const fresh = await prisma.booking.findUnique({ where: { id: booking.id } });
    return NextResponse.json(
      BookingAcceptResponse.parse({
        id: booking.id,
        paymentStatus: safeStatus(fresh?.paymentStatus),
        actionUrl: null,
      }),
      { status: 200 },
    );
  }

  const bookingLocale = booking.locale === 'en' ? 'en' : 'sv';
  const preferredAtLocal = formatProviderDate(
    booking.preferredAt,
    bookingLocale,
    providerTimezoneForCity(instructor.city),
  );
  const learnerMail = bookingRequestApprovedEmail({
    recipientName: booking.studentName,
    instructorName: instructor.name,
    category: booking.category,
    preferredAtLocal,
    bookingId: booking.id,
    confirmPaymentUrl: detailUrl,
    locale: bookingLocale,
  });
  if (booking.studentEmail) {
    sendEmail({ to: booking.studentEmail, ...learnerMail }).catch(() => undefined);
  }
  if (instructor.email) {
    const instructorMail = bookingRequestApprovedInstructorCopyEmail({
      recipientName: instructor.name,
      category: booking.category,
      buyerName: booking.studentName,
      preferredAtLocal,
      bookingId: booking.id,
      origin,
      locale: bookingLocale,
    });
    sendEmail({ to: instructor.email, ...instructorMail }).catch(() => undefined);
  }

  return NextResponse.json(
    BookingAcceptResponse.parse({
      id: booking.id,
      paymentStatus: 'pending',
      actionUrl: detailUrl,
    }),
    { status: 200 },
  );
}

function getTokenFromRequest(req: Request): string | null {
  const authorization = req.headers.get('authorization');
  if (authorization) {
    const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
    if (match?.[1]) return match[1].trim();
  }
  return new URL(req.url).searchParams.get('token');
}

async function releaseSlot(bookingId: string): Promise<void> {
  await prisma.availabilitySlot
    .updateMany({
      where: { bookedBookingId: bookingId },
      data: { bookedAt: null, bookedBookingId: null },
    })
    .catch(() => undefined);
}

function classifyStripeError(error: unknown): PaymentLinkError {
  if (
    error instanceof StripeBillingNotEnabledError ||
    errorName(error) === 'StripeBillingNotEnabledError' ||
    error instanceof StripeBillingConfigurationError ||
    errorName(error) === 'StripeBillingConfigurationError'
  ) {
    return 'not_enabled';
  }
  if (
    error instanceof StripeBillingOnboardingError ||
    errorName(error) === 'StripeBillingOnboardingError'
  ) {
    return 'not_onboarded';
  }
  return 'unknown';
}

function errorName(error: unknown): string | null {
  return error instanceof Error && typeof error.name === 'string' ? error.name : null;
}
