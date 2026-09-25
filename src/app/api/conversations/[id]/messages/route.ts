// @polsia:user-owned — authorized plain-text message creation.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  getBookingParticipantProof,
  loadBookingContext,
  messageProjection,
  participantFor,
  roleForBooking,
} from '@/lib/business/messaging';
import { classifyMessage } from '@/lib/business/messaging-guardrails';
import { MessageInput, SendMessageResponse } from '@/lib/contracts/messaging';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ id: string }> };

async function currentUser(req: Request): Promise<SessionUser | Response> {
  try {
    return await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
}

export async function POST(req: Request, ctx: Context) {
  const user = await currentUser(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const participant = await participantFor(id, user.id);
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ errors: { body: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = MessageInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { errors: { body: 'Write a message up to 2,000 characters.' } },
      { status: 400 },
    );
  }
  const guardrail = classifyMessage(parsed.data.body);
  if (guardrail.blocked) {
    return NextResponse.json(
      SendMessageResponse.parse({
        status: 'blocked',
        categories: guardrail.categories,
        alternative: guardrail.alternativeKey,
      }),
    );
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: { bookingId: true },
  });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const proof = await getBookingParticipantProof(conversation.bookingId);
  const role = roleForBooking(proof, user.id);
  const context = await loadBookingContext(conversation.bookingId);
  if (!proof || !role || !context)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const learnerId = proof.booking.userId;
  const instructorUserId = proof.instructor.userId;
  if (!learnerId || !instructorUserId)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const created = await prisma.message.create({
    data: {
      conversationId: id,
      senderId: user.id,
      body: parsed.data.body,
      moderationState: 'allowed',
    },
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  await prisma.conversation.update({
    where: { id },
    data: { lastMessageAt: created.createdAt },
  });
  return NextResponse.json(
    SendMessageResponse.parse({
      status: 'sent',
      message: messageProjection(created, context, user.id, learnerId, instructorUserId),
    }),
    { status: 201 },
  );
}
