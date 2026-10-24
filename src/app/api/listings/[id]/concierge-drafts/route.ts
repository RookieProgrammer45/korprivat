import 'server-only';
import { NextResponse } from 'next/server';
import { isConciergeOnboardingOn } from '@/lib/acquisition/concierge-policy';
import { listSchoolConciergeDrafts } from '@/lib/acquisition/concierge-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isConciergeOnboardingOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id } = await ctx.params;
  const rows = await listSchoolConciergeDrafts(id, user.id);
  if (!rows) return NextResponse.json({ error: { code: 'not_representative' } }, { status: 403 });
  return NextResponse.json({ items: rows, bookingSurfaces: false });
}
