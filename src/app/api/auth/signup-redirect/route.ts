//
// Returns the dashboard path for the signed-in user's stored role.
// The body is ignored: a client must not be able to set UserProfile.role.

import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { PostLoginRedirect } from '@/lib/contracts/auth';
import { dashboardPathFor } from '@/lib/dashboard-guard';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: session.user.id },
    select: { role: true },
  });

  return NextResponse.json(
    PostLoginRedirect.parse({
      to: dashboardPathFor(profile?.role ?? 'STUDENT'),
    }),
  );
}
