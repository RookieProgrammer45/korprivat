import 'server-only';
import { NextResponse } from 'next/server';
import { participantFor } from '@/lib/business/messaging';
import { MessageReportInput, MessageReportResult } from '@/lib/contracts/messaging';
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
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ errors: { reason: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = MessageReportInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: { reason: 'Choose a report reason.' } }, { status: 400 });
  }
  if (parsed.data.messageId) {
    const message = await prisma.message.findFirst({
      where: { id: parsed.data.messageId, conversationId: id },
      select: { id: true },
    });
    if (!message)
      return NextResponse.json({ errors: { messageId: 'Message not found.' } }, { status: 404 });
  }
  await prisma.messageReport.create({
    data: {
      conversationId: id,
      messageId: parsed.data.messageId ?? null,
      reporterId: user.id,
      reason: parsed.data.reason,
      details: parsed.data.details?.trim() || null,
    },
  });
  return NextResponse.json(MessageReportResult.parse({ status: 'reported' }), {
    status: 201,
  });
}
