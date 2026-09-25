// @polsia:user-owned — authorized conversation detail.
import 'server-only';
import { NextResponse } from 'next/server';
import {
  getBookingParticipantProof,
  loadBookingContext,
  messageProjection,
  participantFor,
  roleForBooking,
  summaryFor,
} from '@/lib/business/messaging';
import { ConversationDetail } from '@/lib/contracts/messaging';
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

export async function GET(req: Request, ctx: Context) {
  const user = await currentUser(req);
  if (user instanceof Response) return user;
  const { id } = await ctx.params;
  const participant = await participantFor(id, user.id);
  if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      id: true,
      bookingId: true,
      learnerId: true,
      instructorId: true,
      lastMessageAt: true,
    },
  });
  if (!conversation) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const proof = await getBookingParticipantProof(conversation.bookingId);
  if (!proof || !roleForBooking(proof, user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const learnerId = proof.booking.userId;
  const instructorUserId = proof.instructor.userId;
  const context = await loadBookingContext(conversation.bookingId);
  if (!context) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const rows = await prisma.message.findMany({
    where: { conversationId: id },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  const summary = await summaryFor(conversation, user.id);
  if (!summary) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(
    ConversationDetail.parse({
      conversation: summary,
      messages: rows.map((message) =>
        messageProjection(message, context, user.id, learnerId, instructorUserId),
      ),
    }),
  );
}
