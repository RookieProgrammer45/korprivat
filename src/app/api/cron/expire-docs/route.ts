// POST /api/cron/expire-docs — mark expired HandledareEnrollment PENDING → EXPIRED
// and VERIFIED InstructorLicense rows past expiresAt → EXPIRED (drops from search).

import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authorizeCron } from '@/lib/payments/cron-auth';
import { reportError } from '@/lib/observability/report-error';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const expiredEnrollments = await prisma.handledareEnrollment.updateMany({
      where: { status: 'PENDING', expiresAt: { lt: now } },
      data: { status: 'EXPIRED' },
    });

    // Sync learner profiles that were waiting on expired invites.
    const expiredRows = await prisma.handledareEnrollment.findMany({
      where: { status: 'EXPIRED', expiresAt: { lt: now } },
      select: { learnerUserId: true },
      take: 200,
    });
    const learnerIds = [...new Set(expiredRows.map((r) => r.learnerUserId))];
    if (learnerIds.length > 0) {
      await prisma.userProfile.updateMany({
        where: {
          userId: { in: learnerIds },
          verificationState: 'HANDLEDARE_PENDING',
        },
        data: { verificationState: 'HANDLEDARE_EXPIRED' },
      });
    }

    const expiredLicenses = await prisma.instructorLicense.updateMany({
      where: {
        status: 'VERIFIED',
        expiresAt: { not: null, lt: now },
      },
      data: { status: 'EXPIRED' },
    });

    return NextResponse.json({
      ok: true,
      expiredEnrollments: expiredEnrollments.count,
      profilesMarkedExpired: learnerIds.length,
      expiredLicenses: expiredLicenses.count,
    });
  } catch (error) {
    await reportError(error, { tags: { area: 'cron', job: 'expire-docs' } });
    return NextResponse.json({ error: 'internal' }, { status: 500 });
  }
}
