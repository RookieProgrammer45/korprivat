import 'server-only';
import { NextResponse } from 'next/server';
import { isLeadDashboardOn } from '@/lib/acquisition/lead-dashboard-policy';
import { readLeadDashboard } from '@/lib/acquisition/lead-dashboard-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isLeadDashboardOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id } = await ctx.params;
  const decision = await readLeadDashboard(id, user.id);
  if (!decision.visible) {
    return NextResponse.json({ error: { code: 'not_representative' } }, { status: 403 });
  }
  return NextResponse.json(decision);
}
