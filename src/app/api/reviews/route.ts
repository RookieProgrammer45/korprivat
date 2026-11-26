// `GET` returns the empty `ReviewList` envelope to prove the table rendered
// on the live DB. POST is out of scope for this iteration.
import 'server-only';
import { NextResponse } from 'next/server';
import { ReviewList } from '@/lib/contracts/reviews';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

// Explicit allow-list of fields the public route returns; mirror the
// `PUBLIC_INSTRUCTOR_SELECT` discipline from `src/lib/contracts/instructors.ts`.
const PUBLIC_REVIEW_SELECT = {
  id: true,
  instructorId: true,
  reviewerName: true,
  rating: true,
  comment: true,
  createdAt: true,
} as const;

export async function GET(req: Request) {
  try {
    await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  const rows = await prisma.review.findMany({
    select: PUBLIC_REVIEW_SELECT,
    orderBy: { createdAt: 'desc' },
  });
  const payload = ReviewList.parse({
    items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  });
  return NextResponse.json(payload);
}
