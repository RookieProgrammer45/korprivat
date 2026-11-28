import 'server-only';
import { prisma } from '@/lib/db';

function missingTable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2021'
  );
}

export type AdminThreadSummary = {
  kind: 'vehicle' | 'booking';
  id: string;
  title: string;
  updatedAt: Date | null;
};

export type AdminThreadMessage = {
  id: string;
  senderName: string;
  senderEmail: string;
  body: string;
  createdAt: Date;
};

export async function listAdminThreads(): Promise<AdminThreadSummary[]> {
  const bookings = await prisma.conversation.findMany({
    orderBy: { lastMessageAt: 'desc' },
    take: 100,
    select: { id: true, bookingId: true, lastMessageAt: true },
  });
  let vehicles: {
    id: string;
    lastMessageAt: Date | null;
    listing: { make: string; model: string; city: string };
  }[] = [];
  try {
    vehicles = await prisma.vehicleConversation.findMany({
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
      select: {
        id: true,
        lastMessageAt: true,
        listing: { select: { make: true, model: true, city: true } },
      },
    });
  } catch (error) {
    if (!missingTable(error)) throw error;
  }
  const rows: AdminThreadSummary[] = [
    ...vehicles.map((conversation) => ({
      kind: 'vehicle' as const,
      id: conversation.id,
      title: `${conversation.listing.make} ${conversation.listing.model} · ${conversation.listing.city}`,
      updatedAt: conversation.lastMessageAt,
    })),
    ...bookings.map((conversation) => ({
      kind: 'booking' as const,
      id: conversation.id,
      title: conversation.bookingId,
      updatedAt: conversation.lastMessageAt,
    })),
  ];
  return rows.sort((a, b) => (b.updatedAt?.getTime() ?? 0) - (a.updatedAt?.getTime() ?? 0));
}

export async function readAdminThread(
  kind: 'vehicle' | 'booking',
  id: string,
): Promise<AdminThreadMessage[]> {
  if (kind === 'vehicle') {
    const conversation = await prisma.vehicleConversation.findUnique({
      where: { id },
      select: {
        buyerUserId: true,
        sellerUserId: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: { id: true, senderId: true, body: true, createdAt: true },
        },
      },
    });
    if (!conversation) return [];
    const people = await prisma.user.findMany({
      where: { id: { in: [conversation.buyerUserId, conversation.sellerUserId] } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(people.map((person) => [person.id, person]));
    return conversation.messages.map((message) => {
      const sender = byId.get(message.senderId);
      return {
        id: message.id,
        senderName: sender?.name ?? '',
        senderEmail: sender?.email ?? '',
        body: message.body,
        createdAt: message.createdAt,
      };
    });
  }
  const conversation = await prisma.conversation.findUnique({
    where: { id },
    select: {
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: { id: true, senderId: true, body: true, createdAt: true },
      },
    },
  });
  if (!conversation) return [];
  const people = await prisma.user.findMany({
    where: { id: { in: conversation.messages.map((message) => message.senderId) } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(people.map((person) => [person.id, person]));
  return conversation.messages.map((message) => {
    const sender = byId.get(message.senderId);
    return {
      id: message.id,
      senderName: sender?.name ?? '',
      senderEmail: sender?.email ?? '',
      body: message.body,
      createdAt: message.createdAt,
    };
  });
}
