import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  providerOwnershipErrorResponse,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import {
  type CompletedLessonProviderRole,
  CompletedLessonsResponse,
} from '@/lib/contracts/completed-lessons';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const PROVIDER_ROLES = new Set<CompletedLessonProviderRole>(['INSTRUCTOR', 'HANDLEDARE']);
const RECENT_LESSON_LIMIT = 5;

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  if (!profile || !PROVIDER_ROLES.has(profile.role as CompletedLessonProviderRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let provider: OwnedProvider | null;
  try {
    provider = await resolveOwnedProvider(user, ['INSTRUCTOR', 'HANDLEDARE']);
  } catch (error) {
    const ownership = providerOwnershipErrorResponse(error);
    if (ownership) {
      return NextResponse.json({ error: ownership.message }, { status: ownership.status });
    }
    throw error;
  }

  // A provider role can exist before its marketplace listing is created. Keep
  // that state honest instead of querying by a guessed or shared identifier.
  if (!provider) {
    return NextResponse.json(
      CompletedLessonsResponse.parse({
        count: 0,
        providerRole: profile.role,
        items: [],
      }),
    );
  }

  const where = {
    instructorId: provider.id,
    completedAt: { not: null },
    paymentStatus: 'released',
    cancelledAt: null,
    cancellationOutcome: null,
    disputeStatus: null,
  };
  const [count, rows] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      take: RECENT_LESSON_LIMIT,
      select: {
        id: true,
        studentName: true,
        category: true,
        preferredAt: true,
        completedAt: true,
      },
    }),
  ]);

  const items = rows.flatMap((row) => {
    if (!row.completedAt) return [];
    return [
      {
        id: row.id,
        learnerName: row.studentName,
        category: row.category,
        lessonDate: row.preferredAt.toISOString(),
        completionDate: row.completedAt.toISOString(),
      },
    ];
  });

  return NextResponse.json(
    CompletedLessonsResponse.parse({
      count,
      providerRole: provider.providerRole,
      items,
    }),
  );
}
