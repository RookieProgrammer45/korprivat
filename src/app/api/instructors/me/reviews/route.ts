//
// GET /api/instructors/me/reviews — signed-in instructor's own review inbox.

import 'server-only';
import { NextResponse } from 'next/server';
import {
  type OwnedProvider,
  ProviderOwnershipError,
  resolveOwnedProvider,
} from '@/lib/business/provider-ownership';
import { ReviewList } from '@/lib/contracts/reviews';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const PUBLIC_REVIEW_SELECT = {
  id: true,
  instructorId: true,
  reviewerName: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (res) {
    return res as Response;
  }

  let instructor: OwnedProvider | null;
  try {
    instructor = await resolveOwnedProvider(user, ['INSTRUCTOR']);
  } catch (error) {
    if (error instanceof ProviderOwnershipError) {
      return NextResponse.json(
        { errors: { id: 'Provider ownership needs operator review.' } },
        { status: 409 },
      );
    }
    throw error;
  }
  if (!instructor) {
    return NextResponse.json({ errors: { id: 'No instructor row for this account' } }, { status: 404 });
  }

  const rows = await prisma.review.findMany({
    where: { instructorId: instructor.id },
    select: PUBLIC_REVIEW_SELECT,
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return NextResponse.json(
    ReviewList.parse({
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    }),
  );
}
