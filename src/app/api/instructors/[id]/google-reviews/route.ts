// Public read for the Google-review snapshot of one instructor.
// GET-only: rows are maintained by the weekly backfill job (Google Places
// (New) Details, `reviews` field), so there is no POST here — the job is
// the only write seam. The route returns an empty envelope when the school
// has no Google data yet, so the client island hides the section entirely.
import 'server-only';
import { NextResponse } from 'next/server';
import { GoogleReviewList } from '@/lib/contracts/google-reviews';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  try {
    await requireAuth(req);
  } catch (res) {
    return res as Response;
  }
  const { id } = await ctx.params;
  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: {
      googleRating: true,
      googleReviewCount: true,
      googleMapsUri: true,
      googleSyncedAt: true,
    },
  });
  if (!instructor) {
    // Same envelope the client islands detect as "not found" without a
    // bespoke shape (mirrors the [id] handler above).
    return NextResponse.json({ errors: { id: 'Not found' } }, { status: 404 });
  }
  const rows = await prisma.googleReview.findMany({
    where: { instructorId: id },
    select: {
      id: true,
      instructorId: true,
      authorName: true,
      rating: true,
      comment: true,
      publishTime: true,
      relativeTime: true,
    },
    orderBy: [{ publishTime: 'desc' }, { fetchedAt: 'desc' }],
    take: 10,
  });
  const hasSummary = instructor.googleRating != null && instructor.googleReviewCount != null;
  const payload = GoogleReviewList.parse({
    items: rows.map((row) => ({
      ...row,
      publishTime: row.publishTime ? row.publishTime.toISOString() : null,
    })),
    summary: hasSummary
      ? {
          rating: instructor.googleRating,
          count: instructor.googleReviewCount,
          mapsUri: instructor.googleMapsUri,
          syncedAt: instructor.googleSyncedAt ? instructor.googleSyncedAt.toISOString() : null,
        }
      : null,
  });
  return NextResponse.json(payload);
}
