// @polsia:user-owned — server-only helpers for booking-scoped messaging.

import type {
  BookingContext,
  ConversationMessage,
  ConversationSummary,
  MessagingRole,
} from '@/lib/contracts/messaging';
import { prisma } from '@/lib/db';

export async function loadBookingContext(bookingId: string): Promise<BookingContext | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      instructorId: true,
      userId: true,
      studentName: true,
      category: true,
      preferredAt: true,
      slotId: true,
    },
  });
  if (!booking) return null;

  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, name: true, userId: true },
  });
  if (!instructor) return null;
  const userIds = [booking.userId, instructor.userId].filter((id): id is string => Boolean(id));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true },
      })
    : [];
  const learnerUser = booking.userId ? users.find((user) => user.id === booking.userId) : undefined;
  const learnerName = learnerUser?.name?.trim() || booking.studentName;

  const slot = booking.slotId
    ? await prisma.availabilitySlot.findUnique({
        where: { id: booking.slotId },
        select: { startsAt: true, durationMinutes: true },
      })
    : null;

  return {
    bookingId: booking.id,
    instructorId: instructor.id,
    learnerName,
    instructorName: instructor.name,
    category: booking.category,
    scheduledAt: (slot?.startsAt ?? booking.preferredAt).toISOString(),
    durationMinutes: slot?.durationMinutes ?? 60,
  };
}

export type BookingParticipantProof = {
  booking: { id: string; instructorId: string; userId: string };
  instructor: { id: string; userId: string };
};

export async function getBookingParticipantProof(
  bookingId: string,
): Promise<BookingParticipantProof | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, instructorId: true, userId: true },
  });
  const learnerId = booking?.userId;
  if (!booking || !learnerId) return null;
  const instructor = await prisma.instructor.findUnique({
    where: { id: booking.instructorId },
    select: { id: true, userId: true },
  });
  const instructorUserId = instructor?.userId;
  if (!instructor || !instructorUserId) return null;
  return {
    booking: { id: booking.id, instructorId: booking.instructorId, userId: learnerId },
    instructor: { id: instructor.id, userId: instructorUserId },
  };
}

export function roleForBooking(
  proof: Awaited<ReturnType<typeof getBookingParticipantProof>>,
  userId: string,
): MessagingRole | null {
  if (!proof) return null;
  if (proof.booking.userId === userId) return 'learner';
  if (proof.instructor.userId === userId) return 'instructor';
  return null;
}

export async function participantFor(conversationId: string, userId: string) {
  return prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    select: { id: true, userId: true, role: true, lastReadAt: true },
  });
}

export function senderName(
  context: BookingContext,
  senderId: string,
  learnerId: string,
  instructorUserId: string,
): string {
  if (senderId === learnerId) return context.learnerName;
  if (senderId === instructorUserId) return context.instructorName;
  return 'DriveLinkUp';
}

export function messageProjection(
  message: { id: string; senderId: string; body: string; createdAt: Date },
  context: BookingContext,
  viewerId: string,
  learnerId: string,
  instructorUserId: string,
): ConversationMessage {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName: senderName(context, message.senderId, learnerId, instructorUserId),
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    isMine: message.senderId === viewerId,
  };
}

export async function summaryFor(
  conversation: {
    id: string;
    bookingId: string;
    learnerId: string;
    instructorId: string;
    lastMessageAt: Date | null;
  },
  viewerId: string,
): Promise<ConversationSummary | null> {
  const context = await loadBookingContext(conversation.bookingId);
  const participant = await participantFor(conversation.id, viewerId);
  if (!context || !participant) return null;
  const proof = await getBookingParticipantProof(conversation.bookingId);
  if (!proof) return null;
  const latest = await prisma.message.findFirst({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: 'desc' },
    select: { id: true, senderId: true, body: true, createdAt: true },
  });
  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conversation.id,
      senderId: { not: viewerId },
      ...(participant.lastReadAt ? { createdAt: { gt: participant.lastReadAt } } : {}),
    },
  });
  const role = roleForBooking(proof, viewerId);
  if (!role) return null;
  return {
    id: conversation.id,
    booking: context,
    role,
    otherParticipantName: role === 'learner' ? context.instructorName : context.learnerName,
    unreadCount,
    lastMessage: latest
      ? messageProjection(latest, context, viewerId, proof.booking.userId, proof.instructor.userId)
      : null,
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
  };
}
