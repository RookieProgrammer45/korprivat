import 'server-only';
import { NextResponse } from 'next/server';
import { isLeadDashboardOn } from '@/lib/acquisition/lead-dashboard-policy';
import { convertLead } from '@/lib/acquisition/lead-dashboard-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; inquiryId: string }> },
) {
  if (!isLeadDashboardOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id, inquiryId } = await ctx.params;
  const result = await convertLead({ listingId: id, inquiryId, userId: user.id });
  return NextResponse.json(result.body, { status: result.status });
}
