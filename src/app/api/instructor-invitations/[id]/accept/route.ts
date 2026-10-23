import 'server-only';
import { NextResponse } from 'next/server';
import { isSchoolMediatedInstructorsOn } from '@/lib/acquisition/mediated-instructor-policy';
import { acceptSchoolInstructorInvitation } from '@/lib/acquisition/mediated-instructor-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSchoolMediatedInstructorsOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  if (!user.email)
    return NextResponse.json({ error: { code: 'invitee_mismatch' } }, { status: 403 });
  const { id } = await ctx.params;
  const result = await acceptSchoolInstructorInvitation({
    invitationId: id,
    userId: user.id,
    email: user.email,
  });
  return NextResponse.json(result.body, { status: result.status });
}
