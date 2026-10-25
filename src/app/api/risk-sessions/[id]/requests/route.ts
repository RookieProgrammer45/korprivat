import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isRiskCoursesOn } from '@/lib/discovery/risk-course-policy';
import { requestRiskCourseSession } from '@/lib/discovery/risk-course-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  studentName: z.string().trim().min(1).max(200),
  studentEmail: z.string().email(),
  instant: z.boolean().optional(),
  hasE4: z.boolean().optional(),
});

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isRiskCoursesOn()) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'invalid_body' } }, { status: 422 });
  }
  const { id } = await ctx.params;
  const result = await requestRiskCourseSession({
    sessionId: id,
    studentName: parsed.data.studentName,
    studentEmail: parsed.data.studentEmail,
    studentUserId: user.id,
    instant: parsed.data.instant,
    hasE4: parsed.data.hasE4,
    studentContactVerified: true,
  });
  return NextResponse.json(result.body, { status: result.status });
}
