// @polsia:user-owned — POST /api/signup/start, idempotent role + path marker.
import 'server-only';
import { NextResponse } from 'next/server';
import { SignupStart } from '@/lib/contracts/signup';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/require-auth';
import { roleForSignupPath } from '@/lib/signup-eligibility';

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
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  const path = parsed.data.path;
  const role = roleForSignupPath(path);
  const current = await prisma.userProfile.findUnique({
    where: { userId: user.id },
    select: { role: true, signupPath: true },
  });
  const marker = await prisma.photoVerification.findUnique({
    where: { userId: user.id },
    select: { signupRole: true },
  });
  if (marker?.signupRole && marker.signupRole !== role) {
    return NextResponse.json(
      { errors: { path: 'This signup is already in progress with another account type.' } },
      { status: 409 },
    );
  }
  if (current && current.role !== 'STUDENT' && current.role !== role) {
    return NextResponse.json(
      { errors: { path: 'This account already uses another marketplace role.' } },
      { status: 409 },
    );
  }

  const startedAt = new Date();
  const dateOfBirth =
    parsed.data.dateOfBirth && !Number.isNaN(Date.parse(parsed.data.dateOfBirth))
      ? new Date(parsed.data.dateOfBirth)
      : null;

  await prisma.userProfile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      role,
      signupPath: path,
      dateOfBirth,
      phone: parsed.data.phone?.trim() || null,
      city: parsed.data.city?.trim() || null,
      schoolName: parsed.data.schoolName?.trim() || null,
      organizationNumber: parsed.data.organizationNumber?.trim() || null,
      licenseHeldYears: parsed.data.licenseHeldYears ?? null,
      ageEstimatedYears: parsed.data.ageEstimatedYears ?? null,
      ageCheckRequestId: parsed.data.ageCheckRequestId?.trim() || null,
      ageCheckStatus: parsed.data.ageCheckStatus?.trim() || null,
    },
    update: {
      role,
      signupPath: path,
      dateOfBirth,
      phone: parsed.data.phone?.trim() || null,
      city: parsed.data.city?.trim() || null,
      schoolName: parsed.data.schoolName?.trim() || null,
      organizationNumber: parsed.data.organizationNumber?.trim() || null,
      licenseHeldYears: parsed.data.licenseHeldYears ?? null,
      ageEstimatedYears: parsed.data.ageEstimatedYears ?? null,
      ageCheckRequestId: parsed.data.ageCheckRequestId?.trim() || null,
      ageCheckStatus: parsed.data.ageCheckStatus?.trim() || null,
    },
  });
  await prisma.photoVerification.upsert({
    where: { userId: user.id },
    create: { userId: user.id, signupRole: role, signupStartedAt: startedAt },
    update: { signupRole: role, signupStartedAt: startedAt },
  });
  return NextResponse.json(
    SignupStartResponse.parse({ role, startedAt: startedAt.toISOString() }),
  );
}
