//
// Public offerings price list for one marketplace profile.
//   GET — active offerings ordered for display. Unknown/invalid instructor
//         ids return an EMPTY 200 list rather than 404: the profile island
//         then hides itself, and a school with zero (or all-hidden)
//         offerings looks exactly like a school before this feature.
import 'server-only';
import { NextResponse } from 'next/server';
import { PublicOfferingList } from '@/lib/contracts/offerings';
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
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(id)) {
    return NextResponse.json(PublicOfferingList.parse({ items: [] }), { status: 200 });
  }
  const instructor = await prisma.instructor.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!instructor) {
    return NextResponse.json(PublicOfferingList.parse({ items: [] }), { status: 200 });
  }
  const rows = await prisma.offering.findMany({
    where: { instructorId: instructor.id, active: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      kind: true,
      name: true,
      description: true,
      priceSek: true,
      sessions: true,
      weeks: true,
    },
  });
  return NextResponse.json(PublicOfferingList.parse({ items: rows }), { status: 200 });
}
