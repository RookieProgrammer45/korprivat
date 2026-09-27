import 'server-only';
import { NextResponse } from 'next/server';
import { buildProviderActivationWhere } from '@/lib/business/provider-activation';
import { ProviderActivationResponse } from '@/lib/contracts/provider-activation';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

const ALLOWED_ROLES = new Set(['INSTRUCTOR', 'HANDLEDARE']);

export async function GET(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });

  if (!profile || !ALLOWED_ROLES.has(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const activatedCount = await prisma.instructor.count({
    where: buildProviderActivationWhere(),
  });

  return NextResponse.json(
    ProviderActivationResponse.parse({
      activatedCount,
      trend: { status: 'neutral' },
    }),
  );
}
