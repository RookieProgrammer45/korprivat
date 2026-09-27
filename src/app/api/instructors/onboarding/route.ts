import 'server-only';
import { NextResponse } from 'next/server';
import { InstructorOnboardingContext } from '@/lib/contracts/instructor-onboarding';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  const role =
    profile?.role === 'INSTRUCTOR' || profile?.role === 'HANDLEDARE' ? profile.role : 'STUDENT';

  return NextResponse.json(InstructorOnboardingContext.parse({ role }));
}
