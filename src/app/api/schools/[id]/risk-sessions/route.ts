import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { isRiskCoursesOn } from '@/lib/discovery/risk-course-policy';
import { publishRiskCourseSession } from '@/lib/discovery/risk-course-store';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  courseType: z.enum(['RISK_1', 'RISK_2']),
  licenceCategory: z.string().trim().min(1),
  municipality: z.string().trim().min(1),
  location: z.string().trim().min(1),
  startsAt: z.string().trim().min(1),
  endsAt: z.string().trim().min(1),
  seatCapacity: z.number().int().positive(),
  priceSek: z.number().int().nonnegative(),
  source: z.enum(['SCHOOL_PUBLISHED', 'ACQ_DRAFT']).default('SCHOOL_PUBLISHED'),
  schoolApproved: z.boolean().default(false),
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
  const { id: listingId } = await ctx.params;
  const representative = await prisma.listingRepresentativeAuthority.findUnique({
    where: { listingId_userId: { listingId, userId: user.id } },
  });
  if (!representative?.verifiedAt || !representative.evidenceRef) {
    return NextResponse.json({ error: { code: 'not_representative' } }, { status: 403 });
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
  const listing = await prisma.instructor.findUnique({
    where: { id: listingId },
    select: { city: true },
  });
  const membership = await prisma.membership.findFirst({
    where: { userId: user.id, status: 'ACTIVE' },
    include: { organization: { select: { organizationNumber: true } } },
  });
  const result = await publishRiskCourseSession({
    listingId,
    ...parsed.data,
    listingLegalEntity: membership?.organization?.organizationNumber ?? '',
    listingLocation: listing?.city ?? parsed.data.municipality,
  });
  return NextResponse.json(result.body, { status: result.status });
}
