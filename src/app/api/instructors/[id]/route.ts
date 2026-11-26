import 'server-only';
import { NextResponse } from 'next/server';
import { InstructorItem } from '@/lib/contracts/instructors';
import { loadPublicListingById } from '@/lib/discovery/public-listing';
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
  const listing = await loadPublicListingById(id);
  if (!listing) {
    // Same envelope the form's `applyServerErrors` consumes, so the client
    // island can detect "not found" without a bespoke shape.
    return NextResponse.json({ errors: { id: 'Not found' } }, { status: 404 });
  }
  return NextResponse.json(InstructorItem.parse(listing));
}
