// Co-locates GET (scoped to one instructor) and POST (writes one row).
// Mirrors the async `params: Promise<{ id: string }>` pattern from
// `src/app/api/instructors/[id]/availability/route.ts` and the FK-re-validate
// pattern (instructorId → prisma.instructor.findUnique) from
// `src/app/api/bookings/route.ts` — `prisma db push` does not add a FK between
// Review.instructorId and Instructor.id, so the handler is the only line of
// defense for the FK invariant and the rating 1-5 range.
import 'server-only';
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import {
  ReviewCreate,
  type ReviewEligibility,
  ReviewItem,
  ReviewList,
} from '@/lib/contracts/reviews';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

// Public allow-list of fields the route returns; mirrors the discipline in
// `src/app/api/reviews/route.ts` so the contract and the Prisma select stay
// in lockstep.
const PUBLIC_REVIEW_SELECT = {
  id: true,
  instructorId: true,
  reviewerName: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const rows = await prisma.review.findMany({
    where: { instructorId: id },
    select: PUBLIC_REVIEW_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  const bookingId = new URL(req.url).searchParams.get('bookingId');
  const eligibility = bookingId ? await getEligibility(req, id, bookingId) : undefined;
  const payload = ReviewList.parse({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    ...(eligibility ? { eligibility } : {}),
  });
  return NextResponse.json(payload);
}

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }

  const parsed = ReviewCreate.safeParse(bodyJson);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    const errors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      const message = messages?.[0];
      if (message) {
        errors[field] = message;
      }
    }
    return NextResponse.json({ errors }, { status: 400 });
  }

  const data = parsed.data;

  // The path id is the source of truth for the instructor this review
  // belongs to — defends against a tampered client submitting a review
  // against an unrelated instructor via the body field.
  if (data.instructorId !== id) {
    return NextResponse.json(
      { errors: { instructorId: 'Instructor id mismatch' } },
      { status: 400 },
    );
  }

  // FK re-validate: `prisma db push` does not add a FK between
  // Review.instructorId and Instructor.id, so a tampered client could
  // submit an instructorId that points at nothing — handler is the only
  // line of defense. Mirrors the guard at `src/app/api/bookings/route.ts`.
  const instructor = await prisma.instructor.findUnique({
    where: { id: data.instructorId },
    select: { id: true },
  });
  if (!instructor) {
    return NextResponse.json({ errors: { instructorId: 'Unknown instructor' } }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({
    where: { id: data.bookingId },
    select: {
      userId: true,
      studentEmail: true,
      instructorId: true,
      completedAt: true,
      paymentStatus: true,
      cancellationOutcome: true,
      disputeStatus: true,
    },
  });
  if (!booking || !ownsBooking(booking, user)) {
    return NextResponse.json(
      { errors: { bookingId: 'Booking is not available' } },
      { status: 403 },
    );
  }
  if (booking.instructorId !== id) {
    return NextResponse.json(
      { errors: { bookingId: 'Booking does not belong to this instructor' } },
      { status: 403 },
    );
  }
  if (
    !booking.completedAt ||
    booking.paymentStatus !== 'released' ||
    booking.cancellationOutcome !== null ||
    booking.disputeStatus === 'open'
  ) {
    return NextResponse.json(
      { errors: { bookingId: 'Lesson is not eligible for a review' } },
      { status: 409 },
    );
  }

  try {
    const created = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.review.findFirst({
          where: { bookingId: data.bookingId },
          select: { id: true },
        });
        if (existing) throw new DuplicateReviewError();

        return tx.review.create({
          data: {
            instructorId: data.instructorId,
            bookingId: data.bookingId,
            reviewerName: user.name?.trim() || data.reviewerName,
            rating: data.rating,
            comment: data.comment,
          },
          select: PUBLIC_REVIEW_SELECT,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return NextResponse.json(
      ReviewItem.parse({ ...created, createdAt: created.createdAt.toISOString() }),
      { status: 201 },
    );
  } catch (error: unknown) {
    if (error instanceof DuplicateReviewError || isTransactionConflict(error)) {
      return NextResponse.json(
        { errors: { bookingId: 'A review already exists for this booking' } },
        { status: 409 },
      );
    }
    throw error;
  }
}

class DuplicateReviewError extends Error {
  constructor() {
    super('A review already exists for this booking');
    this.name = 'DuplicateReviewError';
  }
}

async function getEligibility(
  req: Request,
  instructorId: string,
  bookingId: string,
): Promise<ReviewEligibility> {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch {
    return { status: 'not_eligible' };
  }
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true,
      studentEmail: true,
      instructorId: true,
      completedAt: true,
      paymentStatus: true,
      cancellationOutcome: true,
      disputeStatus: true,
    },
  });
  if (!booking || booking.instructorId !== instructorId || !ownsBooking(booking, user)) {
    return { status: 'not_eligible' };
  }
  const existing = await prisma.review.findFirst({ where: { bookingId } });
  if (existing) return { status: 'already_reviewed' };
  return {
    status:
      booking.completedAt &&
      booking.paymentStatus === 'released' &&
      booking.cancellationOutcome === null &&
      booking.disputeStatus !== 'open'
        ? 'eligible'
        : 'not_eligible',
  };
}

function ownsBooking(
  booking: { userId: string | null; studentEmail: string },
  user: SessionUser,
): boolean {
  if (booking.userId) return booking.userId === user.id;
  return booking.studentEmail.trim().toLowerCase() === user.email.trim().toLowerCase();
}

function isTransactionConflict(error: unknown): boolean {
  return error !== null && typeof error === 'object' && 'code' in error && error.code === 'P2034';
}
