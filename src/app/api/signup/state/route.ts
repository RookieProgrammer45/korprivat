// @polsia:user-owned — GET /api/signup/state, owner-scoped resume state.
import 'server-only';
import { NextResponse } from 'next/server';
import { photoState } from '@/lib/business/photo-verification';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { SignupState } from '@/lib/contracts/signup';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

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
  const role =
    profile?.role === 'INSTRUCTOR' || profile?.role === 'HANDLEDARE' ? profile.role : 'STUDENT';
  const photo = await photoState(user.id);
  const [license, clickwrap] = await Promise.all([
    role === 'INSTRUCTOR'
      ? prisma.instructorLicense.findUnique({ where: { userId: user.id }, select: { id: true } })
      : null,
    role === 'HANDLEDARE'
      ? prisma.clickwrapAcceptance.findUnique({
          where: { userId: user.id },
          select: { termsVersion: true },
        })
      : null,
  ]);
  const nextPrerequisite =
    photo.status !== 'CONFIRMED'
      ? 'photo'
      : role === 'INSTRUCTOR' && !license
        ? 'license'
        : role === 'HANDLEDARE' && clickwrap?.termsVersion !== HANDLEDARE_TERMS_VERSION
          ? 'clickwrap'
          : 'complete';
  return NextResponse.json(SignupState.parse({ role, photo, nextPrerequisite }));
}
