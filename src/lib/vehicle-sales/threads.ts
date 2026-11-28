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

export type ThreadMessage = {
  id: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

export type ListingThread = {
  id: string;
  buyerUserId: string;
  buyerName: string;
  messages: ThreadMessage[];
};

export async function listListingThreads(
  listingId: string,
  viewerId: string,
  ownerId: string,
): Promise<ListingThread[]> {
  try {
    const conversations = await prisma.vehicleConversation.findMany({
      where:
        viewerId === ownerId
          ? { listingId, sellerUserId: ownerId }
          : { listingId, buyerUserId: viewerId },
      orderBy: { lastMessageAt: 'desc' },
      select: {
        id: true,
        buyerUserId: true,
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 200,
          select: { id: true, senderId: true, body: true, createdAt: true },
        },
      },
    });
    const buyers = await prisma.user.findMany({
      where: { id: { in: conversations.map((conversation) => conversation.buyerUserId) } },
      select: { id: true, name: true },
    });
    const nameById = new Map(buyers.map((buyer) => [buyer.id, buyer.name]));
    return conversations.map((conversation) => ({
      id: conversation.id,
      buyerUserId: conversation.buyerUserId,
      buyerName: nameById.get(conversation.buyerUserId) ?? '',
      messages: conversation.messages,
    }));
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export type MyVehicleThread = {
  id: string;
  listingId: string;
  title: string;
  otherName: string;
};

export async function listMyVehicleThreads(userId: string): Promise<MyVehicleThread[]> {
  try {
    const conversations = await prisma.vehicleConversation.findMany({
      where: { OR: [{ buyerUserId: userId }, { sellerUserId: userId }] },
      orderBy: { lastMessageAt: 'desc' },
      take: 20,
      select: {
        id: true,
        listingId: true,
        buyerUserId: true,
        sellerUserId: true,
        listing: { select: { make: true, model: true, city: true } },
      },
    });
    const otherIds = conversations.map((conversation) =>
      conversation.buyerUserId === userId ? conversation.sellerUserId : conversation.buyerUserId,
    );
    const people = await prisma.user.findMany({
      where: { id: { in: otherIds } },
      select: { id: true, name: true },
    });
    const nameById = new Map(people.map((person) => [person.id, person.name]));
    return conversations.map((conversation) => {
      const otherId =
        conversation.buyerUserId === userId ? conversation.sellerUserId : conversation.buyerUserId;
      return {
        id: conversation.id,
        listingId: conversation.listingId,
        title: `${conversation.listing.make} ${conversation.listing.model} · ${conversation.listing.city}`,
        otherName: nameById.get(otherId) ?? '',
      };
    });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}
