// POST /api/instructors/me/connect/refresh — sync Connect flags from Stripe.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ConnectInstructorNotFoundError,
  ConnectNotConfiguredError,
  refreshInstructorConnectStatus,
} from '@/lib/payments/connect';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (profile?.role !== 'INSTRUCTOR') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const instructor = await prisma.instructor.findFirst({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!instructor) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  try {
    const status = await refreshInstructorConnectStatus(instructor.id);
    return NextResponse.json(status, { status: 200 });
  } catch (err) {
    if (err instanceof ConnectInstructorNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof ConnectNotConfiguredError) {
      return NextResponse.json({ error: 'payments_not_enabled' }, { status: 403 });
    }
    console.error('[instructors/me/connect/refresh] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
