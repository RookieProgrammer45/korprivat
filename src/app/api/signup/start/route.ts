// @polsia:user-owned — POST /api/signup/start, idempotent role marker.
import 'server-only';
import { NextResponse } from 'next/server';
import { SignupStart } from '@/lib/contracts/signup';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: { form: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = SignupStart.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: { role: 'Choose a valid account type.' } }, { status: 400 });
  const current = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true },
  });
  const marker = await prisma.photoVerification.findUnique({
    where: { userId: user.id },
    select: { signupRole: true },
  });
  if (marker?.signupRole && marker.signupRole !== parsed.data.role) {
    return NextResponse.json(
      { errors: { role: 'This signup is already in progress with another account type.' } },
      { status: 409 },
    );
  }
  if (current && current.role !== 'STUDENT' && current.role !== parsed.data.role) {
    return NextResponse.json(
      { errors: { role: 'This account already uses another marketplace role.' } },
      { status: 409 },
    );
  }
  const startedAt = new Date();
  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: { userId: user.id, role: parsed.data.role },
    update: { role: parsed.data.role },
  });
  await prisma.photoVerification.upsert({
    where: { userId: user.id },
    create: { userId: user.id, signupRole: parsed.data.role, signupStartedAt: startedAt },
    update: { signupRole: parsed.data.role, signupStartedAt: startedAt },
  });
  return NextResponse.json(
    SignupStartResponse.parse({ role: parsed.data.role, startedAt: startedAt.toISOString() }),
  );
}
