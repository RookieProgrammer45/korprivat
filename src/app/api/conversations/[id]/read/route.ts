// @polsia:user-owned — mark only the caller's conversation participant read.
import 'server-only';
import { NextResponse } from 'next/server';
import { participantFor } from '@/lib/business/messaging';
import { ReadResponse } from '@/lib/contracts/messaging';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Context) {
  let user: SessionUser;
  try {
    user = await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
  const { id } = await ctx.params;
  const participant = await participantFor(id, user.id);
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const readAt = new Date();
  await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: readAt },
  });
  return NextResponse.json(ReadResponse.parse({ readAt: readAt.toISOString() }));
}
