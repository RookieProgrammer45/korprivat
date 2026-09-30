// POST /api/instructors/me/connect — mint Stripe Connect Express onboarding link.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  ConnectAccountMissingError,
  ConnectInstructorNotFoundError,
  ConnectNotConfiguredError,
  createInstructorConnectAccount,
  createInstructorOnboardingLink,
} from '@/lib/payments/connect';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

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
    await createInstructorConnectAccount(instructor.id);

    const base = appBaseUrl();
    const { url } = await createInstructorOnboardingLink(
      instructor.id,
      `${base}/dashboard/instructor?connect=done`,
      `${base}/dashboard/instructor?connect=refresh`,
    );

    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    if (err instanceof ConnectInstructorNotFoundError) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (err instanceof ConnectNotConfiguredError || err instanceof ConnectAccountMissingError) {
      return NextResponse.json({ error: 'payments_not_enabled' }, { status: 403 });
    }
    console.error('[instructors/me/connect] unhandled', err);
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
