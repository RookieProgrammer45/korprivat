//
// Per-instructor lookup the rebook affordance on `/instructors/[id]` runs to
// pre-fill the booking form. Returns the user's most-recent booking with
// that instructor — `category`, `studentName`, `studentEmail`,
// `studentPhone`, the server-side `hourlyRateSek` snapshot, and the
// `preferredAt` ISO that drove the original lesson.
//
// Owner-scoped via `requireAuth(req)` + `where: { userId: user.id,
// instructorId: <route param> }`. The query SHORT-circuits to
// `{ suggested: null }` (not 404) so the client island can render a
// "no rebook yet" empty-state without misclassifying a missing record as
// an error.
//
// Why a NEW endpoint (and not reusing `/api/bookings/[id]`): the rebook
// hint is keyed on `(userId, instructorId)` — there is no `Booking.id`
// yet — and the size of the response is intentionally small (no token,
// no dispute state, no payment details). The dedicated endpoint keeps the
// shape compact for the booking-form prefill.

import 'server-only';
import { NextResponse } from 'next/server';
import { RebookSuggestResponse } from '@/lib/contracts/saved-payment-methods';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  const url = new URL(req.url);
  const rawInstructorId = url.searchParams.get('instructorId');
  if (!rawInstructorId) {
    return NextResponse.json({ errors: { instructorId: 'Missing instructorId' } }, { status: 400 });
  }

  const latest = await prisma.booking.findFirst({
    where: {
      userId: user.id,
      instructorId: rawInstructorId,
      paymentStatus: {
        notIn: ['cancelled_early', 'cancelled_late', 'refunded'],
      },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      instructorId: true,
      category: true,
      studentName: true,
      studentEmail: true,
      studentPhone: true,
      preferredAt: true,
    },
  });

  if (!latest) {
    return NextResponse.json(RebookSuggestResponse.parse({ suggested: null }));
  }

  const instructor = await prisma.instructor.findUnique({
    where: { id: latest.instructorId },
    select: { hourlyRateSek: true },
  });

  return NextResponse.json(
    RebookSuggestResponse.parse({
      suggested: {
        instructorId: latest.instructorId,
        category: latest.category,
        studentName: latest.studentName,
        studentEmail: latest.studentEmail,
        studentPhone: latest.studentPhone,
        hourlyRateSek: instructor?.hourlyRateSek ?? 0,
        preferredAt: latest.preferredAt.toISOString(),
      },
    }),
  );
}
