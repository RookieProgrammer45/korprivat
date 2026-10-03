// GET /api/admin/manual-review — learners stuck in MANUAL_REVIEW.
// POST — admin resolves to ACTIVE or BLOCKED_UNDERAGE.

import 'server-only';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function assertAdmin(): Promise<NextResponse | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const rows = await prisma.userProfile.findMany({
    where: { verificationState: 'MANUAL_REVIEW' },
    select: {
      userId: true,
      dateOfBirth: true,
      dateOfBirthVerified: true,
      diditAttempts: true,
      diditLastDecision: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  return NextResponse.json({ items: rows });
}

const resolveSchema = z.object({
  userId: z.string().min(1),
  outcome: z.enum(['ACTIVE', 'BLOCKED_UNDERAGE']),
  note: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  const forbidden = await assertAdmin();
  if (forbidden) return forbidden;

  const session = await auth.api.getSession({ headers: await headers() });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = resolveSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId: parsed.data.userId },
    select: { verificationState: true },
  });
  if (!profile || profile.verificationState !== 'MANUAL_REVIEW') {
    return NextResponse.json({ error: 'not_in_review' }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.userProfile.update({
      where: { userId: parsed.data.userId },
      data: { verificationState: parsed.data.outcome },
    }),
    prisma.verificationEvent.create({
      data: {
        subjectType: 'LEARNER',
        subjectId: parsed.data.userId,
        actorId: session?.user?.id ?? null,
        fromStatus: 'MANUAL_REVIEW',
        toStatus: parsed.data.outcome,
        note: parsed.data.note ?? 'admin_manual_review',
      },
    }),
  ]);

  return NextResponse.json({ ok: true, state: parsed.data.outcome });
}
