// @polsia:user-owned — booking-scoped conversation list and creation.
import 'server-only';
import { NextResponse } from 'next/server';
import { getBookingParticipantProof, roleForBooking, summaryFor } from '@/lib/business/messaging';
import {
  ConversationList,
  CreateConversationInput,
  CreateConversationResult,
} from '@/lib/contracts/messaging';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function currentUser(req: Request): Promise<SessionUser | Response> {
  try {
    return await requireAuth(req);
  } catch (response) {
    return response as Response;
  }
}

export async function GET(req: Request) {
  const user = await currentUser(req);
  if (user instanceof Response) return user;
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId: user.id } } },
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: {
      id: true,
      bookingId: true,
      learnerId: true,
      instructorId: true,
      lastMessageAt: true,
    },
  });
  const items = (
    await Promise.all(conversations.map((conversation) => summaryFor(conversation, user.id)))
  ).filter((item): item is NonNullable<typeof item> => item !== null);
  return NextResponse.json(ConversationList.parse({ items }));
}

export async function POST(req: Request) {
  const user = await currentUser(req);
  if (user instanceof Response) return user;
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ errors: { bookingId: 'Invalid JSON body' } }, { status: 400 });
  }
  const parsed = CreateConversationInput.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ errors: { bookingId: 'A booking is required.' } }, { status: 400 });
  }
  const proof = await getBookingParticipantProof(parsed.data.bookingId);
  const role = roleForBooking(proof, user.id);
  if (!proof || !role) {
    return NextResponse.json(
      { errors: { bookingId: 'This booking is not available for messaging.' } },
      { status: 403 },
    );
  }
  const learnerId = proof.booking.userId;
  const instructorUserId = proof.instructor.userId;

  let conversation = await prisma.conversation.findUnique({
    where: { bookingId: parsed.data.bookingId },
    select: {
      id: true,
      bookingId: true,
      learnerId: true,
      instructorId: true,
      lastMessageAt: true,
    },
  });
  if (!conversation) {
    try {
      conversation = await prisma.conversation.create({
        data: {
          bookingId: parsed.data.bookingId,
          learnerId,
          instructorId: instructorUserId,
          participants: {
            create: [
              { userId: learnerId, role: 'learner' },
              { userId: instructorUserId, role: 'instructor' },
            ],
          },
        },
        select: {
          id: true,
          bookingId: true,
          learnerId: true,
          instructorId: true,
          lastMessageAt: true,
        },
      });
    } catch (error: unknown) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002'))
        throw error;
      conversation = await prisma.conversation.findUnique({
        where: { bookingId: parsed.data.bookingId },
        select: {
          id: true,
          bookingId: true,
          learnerId: true,
          instructorId: true,
          lastMessageAt: true,
        },
      });
    }
  }
  if (!conversation)
    return NextResponse.json({ error: 'Could not open conversation.' }, { status: 500 });
  const summary = await summaryFor(conversation, user.id);
  if (!summary)
    return NextResponse.json({ error: 'Conversation is unavailable.' }, { status: 403 });
  return NextResponse.json(CreateConversationResult.parse({ conversation: summary }), {
    status: 201,
  });
}
