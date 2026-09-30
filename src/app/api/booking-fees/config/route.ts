//
// Provider-only fee configuration used by the authenticated payout card.
// Learner-facing pages use `/api/booking-fees/quote`, which never exposes
// commission configuration.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  INSTRUCTOR_COMMISSION_PERCENT,
  LEARNER_SERVICE_FEE_PERCENT,
  SCHOOL_COMMISSION_PERCENT,
} from '@/lib/business/booking-fees';
import { InstructorFeesConfig } from '@/lib/contracts/booking-fees';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(request);
  } catch (res) {
    return res as Response;
  }

  const instructor = await prisma.instructor.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });

  if (!instructor) {
    return NextResponse.json(
      { errors: { account: 'Instructor account required' } },
      { status: 403 },
    );
  }

  return NextResponse.json(
    InstructorFeesConfig.parse({
      serviceFeePercent: LEARNER_SERVICE_FEE_PERCENT,
      commissionPercent: INSTRUCTOR_COMMISSION_PERCENT,
      schoolCommissionPercent: SCHOOL_COMMISSION_PERCENT,
    }),
  );
}
