import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TEACHING_CATEGORIES } from '@/lib/acquisition/claim-policy';
import { isSchoolMediatedInstructorsOn } from '@/lib/acquisition/mediated-instructor-policy';
import { inviteSchoolInstructor } from '@/lib/acquisition/mediated-instructor-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().trim().email(),
  teachingCategories: z.array(z.enum(TEACHING_CATEGORIES)).min(1),
  inventoryDelegated: z.boolean().optional(),
});

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
  const { id } = await ctx.params;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  const result = await inviteSchoolInstructor({
    schoolListingId: id,
    actorUserId: user.id,
    email: parsed.data.email,
    teachingCategories: parsed.data.teachingCategories,
    inventoryDelegated: parsed.data.inventoryDelegated ?? false,
  });
  return NextResponse.json(result.body, { status: result.status });
}
