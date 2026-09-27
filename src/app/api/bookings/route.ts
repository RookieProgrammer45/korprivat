import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { generateLearnerAccessToken } from '@/lib/business/booking-access';
import { learnerTotalSek } from '@/lib/business/booking-fees';
import { generateBookingToken } from '@/lib/business/escrow';
import { isLicenceCategoryCode } from '@/lib/business/licence-categories';
import { formatProviderDate, providerTimezoneForCity } from '@/lib/business/provider-timezone';
import { recordRebookingContext } from '@/lib/business/rebooking-cache';
import { BookingCreate, BookingCreated, type BookingCreateMode } from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import {
  bookingRequestSubmittedEmail,
  studentBookingRequestReceivedEmail,
} from '@/lib/email/templates';
import { resolveOrigin } from '@/lib/payments/origin';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import { resolveLearnerState } from '@/lib/verification/state';

export const dynamic = 'force-dynamic';

function plainTextHtml(text: string): string {
  return text
    .split('\n')
    .map((line) => escapeHtml(line))
    .join('<br>');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

class BookingConflictError extends Error {
  constructor() {
    super('The selected slot is no longer available');
    this.name = 'BookingConflictError';
  }
}

export async function POST(req: Request) {
  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = BookingCreate.safeParse(bodyJson);
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

  let sessionUser: SessionUser;
  try {
    sessionUser = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: sessionUser.id },
    select: { dateOfBirth: true },
  });

  // TODO: Tighten to require ACTIVE once Didit webhook writes
  // dateOfBirthVerified (see docs/learner-verification-flow.md §5).
  const learnerState = resolveLearnerState({
    currentState: 'SIGNED_UP',
    claimedDob: profile?.dateOfBirth ?? null,
    verifiedDob: null,
    diditDecision: null,
    diditAttempts: 0,
    handledareEnrollment: null,
  });
  if (learnerState === 'BLOCKED_UNDERAGE' || learnerState === 'SUSPENDED') {
    return NextResponse.json(
      { error: 'learner_not_eligible', state: learnerState },
      { status: 403 },
    );
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: data.instructorId },
    select: {
      id: true,
      name: true,
      city: true,
      categories: true,
      hourlyRateSek: true,
      email: true,
      cancellationPolicyTier: true,
      bookingMode: true,
    },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { instructorId: 'Unknown instructor' } }, { status: 400 });
  }

  if (!isLicenceCategoryCode(data.category) || !instructor.categories.includes(data.category)) {
    return NextResponse.json(
      { errors: { category: 'Instructor is not certified for this category' } },
      { status: 400 },
    );
  }

  const instructorMode: BookingCreateMode =
    instructor.bookingMode === 'request' ? 'request' : 'instant';
  const submittedMode: BookingCreateMode = data.mode ?? instructorMode;
  if (submittedMode !== instructorMode) {
    return NextResponse.json(
      {
        errors: {
          mode:
            instructorMode === 'instant'
              ? 'This school listing only accepts instant bookings'
              : 'This school listing only accepts request-to-book',
        },
      },
      { status: 409 },
    );
  }

  const totals = learnerTotalSek(instructor.hourlyRateSek);
  const learnerAccess = generateLearnerAccessToken();
  const actionToken = instructorMode === 'request' ? generateBookingToken() : null;

  let transactionResult: { id: string; startsAt: Date };
  try {
    transactionResult = await prisma.$transaction(
      async (tx) => {
        const slot = await tx.availabilitySlot.findFirst({
          where: {
            id: data.slotId,
            instructorId: data.instructorId,
            bookedAt: null,
            startsAt: { gt: new Date() },
          },
          select: { id: true, startsAt: true },
        });
        if (!slot) throw new BookingConflictError();

        if (instructorMode === 'request') {
          const activeRequest = await tx.booking.findFirst({
            where: { slotId: slot.id, paymentStatus: 'awaiting_approval' },
            select: { id: true },
          });
          if (activeRequest) throw new BookingConflictError();
        }

        const created = await tx.booking.create({
          data: {
            instructorId: data.instructorId,
            slotId: slot.id,
            userId: sessionUser.id,
            studentName: data.studentName,
            studentEmail: data.studentEmail,
            studentPhone: data.studentPhone,
            category: data.category,
            preferredAt: slot.startsAt,
            cancellationPolicyTier: instructor.cancellationPolicyTier ?? 'flexible',
            bookingMode: instructorMode,
            locale: data.locale ?? 'en',
            paymentStatus: instructorMode === 'request' ? 'awaiting_approval' : 'unpaid',
            priceAmountSek: totals.priceSek,
            serviceFeeSek: totals.serviceFeeSek,
            grossChargedSek: totals.totalSek,
            learnerAccessTokenHash: learnerAccess.tokenHash,
            ...(actionToken ? { actionToken } : {}),
          },
          select: { id: true },
        });

        if (instructorMode === 'instant') {
          const slotUpdated = await tx.availabilitySlot.updateMany({
            where: { id: slot.id, bookedAt: null },
            data: { bookedAt: new Date(), bookedBookingId: created.id },
          });
          if (slotUpdated.count !== 1) throw new BookingConflictError();
        }

        return { id: created.id, startsAt: slot.startsAt };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof BookingConflictError || isSerializableConflict(error)) {
      return NextResponse.json({ errors: { slotId: 'Slot no longer available' } }, { status: 409 });
    }
    throw error;
  }

  const origin = resolveOrigin(req);
  const bookingUrl = `${origin}/bookings/${encodeURIComponent(transactionResult.id)}?token=${encodeURIComponent(learnerAccess.token)}`;
  await notifyAfterBooking({
    instructor,
    instructorMode,
    studentName: data.studentName,
    studentEmail: data.studentEmail,
    studentPhone: data.studentPhone,
    category: data.category,
    slotStartsAt: transactionResult.startsAt,
    bookingId: transactionResult.id,
    actionToken,
    bookingUrl,
    origin,
    locale: data.locale === 'sv' ? 'sv' : 'en',
  }).catch(() => undefined);

  await recordRebookingContext({
    userId: sessionUser.id,
    instructorId: data.instructorId,
    category: data.category,
    studentName: data.studentName,
    studentPhone: data.studentPhone,
    lastBookingId: transactionResult.id,
  });

  return NextResponse.json(
    BookingCreated.parse({
      id: transactionResult.id,
      hourlyRateSek: instructor.hourlyRateSek,
      learnerAccessToken: learnerAccess.token,
    }),
    { status: 201 },
  );
}

function isSerializableConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2034'
  );
}

async function notifyAfterBooking(input: {
  instructor: {
    name: string;
    city: string;
    email: string | null;
  };
  instructorMode: BookingCreateMode;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  category: string;
  slotStartsAt: Date;
  bookingId: string;
  actionToken: string | null;
  bookingUrl: string;
  origin: string;
  locale: 'sv' | 'en';
}): Promise<void> {
  const preferredAtLocal = formatProviderDate(
    input.slotStartsAt,
    input.locale,
    providerTimezoneForCity(input.instructor.city),
  );
  const tasks: Array<Promise<unknown>> = [];
  const learnerMail = studentBookingRequestReceivedEmail({
    studentName: input.studentName,
    category: input.category,
    bookingId: input.bookingId,
    instructorName: input.instructor.name,
    preferredAtLocal,
    instructorCity: input.instructor.city,
    bookingUrl: input.bookingUrl,
    locale: input.locale,
  });
  tasks.push(
    sendEmail({
      to: input.studentEmail,
      subject: learnerMail.subject,
      text: learnerMail.text ?? '',
      html: learnerMail.html ?? plainTextHtml(learnerMail.text ?? ''),
    }).catch(() => undefined),
  );

  if (input.instructor.email) {
    const reviewUrl =
      input.instructorMode === 'request' && input.actionToken
        ? `${input.origin}/bookings/${encodeURIComponent(input.bookingId)}/accept?token=${encodeURIComponent(input.actionToken)}`
        : undefined;
    const instructorMail = bookingRequestSubmittedEmail({
      recipientName: input.instructor.name,
      bookingMode: input.instructorMode,
      category: input.category,
      bookingId: input.bookingId,
      studentName: input.studentName,
      studentEmail: input.studentEmail,
      studentPhone: input.studentPhone,
      preferredAtLocal,
      instructorCity: input.instructor.city,
      reviewUrl,
      locale: input.locale,
    });
    tasks.push(
      sendEmail({
        to: input.instructor.email,
        subject: instructorMail.subject,
        text: instructorMail.text,
        html: instructorMail.html,
      }).catch(() => undefined),
    );
  }

  await Promise.allSettled(tasks);
}
