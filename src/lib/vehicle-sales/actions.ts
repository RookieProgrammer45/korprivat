'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { dealerCountries } from '@/lib/discovery/dealerships';
import { estimateMarketPrice } from '@/lib/discovery/vehicle-market-price';
import { sendEmail } from '@/lib/email/send';
import { getSessionUser } from '@/lib/require-auth';
import { absoluteUrl } from '@/lib/seo/alternates';
import { catalogueComparables } from '@/lib/vehicle-sales/catalogue';
import { canUseVehicleChat, vehiclePostDecision } from '@/lib/vehicle-sales/conversation-access';
import { ownedVehicleSchema, vehicleThreadSchema } from '@/lib/vehicle-sales/schema';

export type SaleActionResult =
  | {
      ok: true;
      estimate: {
        currency: string;
        amount: number | null;
        low: number | null;
        high: number | null;
        count: number;
        buyers: { dealerId: string; name: string; city: string; sourceUrl: string }[];
      };
      listingId?: string;
    }
  | { ok: false; error: 'auth' | 'invalid' | 'identifier' | 'own' | 'limit' };

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

async function signedInUser() {
  return getSessionUser();
}

export async function estimateOwnedVehicle(input: unknown): Promise<SaleActionResult> {
  const user = await signedInUser();
  if (!user) return { ok: false, error: 'auth' };
  const parsed = ownedVehicleSchema.safeParse(input);
  if (!parsed.success) {
    const identifier = parsed.error.issues.some((issue) => issue.message === 'identifier');
    return { ok: false, error: identifier ? 'identifier' : 'invalid' };
  }
  const countries = new Set(dealerCountries());
  if (!countries.has(parsed.data.country)) return { ok: false, error: 'invalid' };
  const estimate = estimateMarketPrice(parsed.data, catalogueComparables());
  return { ok: true, estimate };
}

export async function publishOwnedVehicle(input: unknown): Promise<SaleActionResult> {
  const user = await signedInUser();
  if (!user) return { ok: false, error: 'auth' };
  const parsed = ownedVehicleSchema.safeParse(input);
  if (!parsed.success) {
    const identifier = parsed.error.issues.some((issue) => issue.message === 'identifier');
    return { ok: false, error: identifier ? 'identifier' : 'invalid' };
  }
  if (!dealerCountries().includes(parsed.data.country)) return { ok: false, error: 'invalid' };
  const estimate = estimateMarketPrice(parsed.data, catalogueComparables());
  const listing = await prisma.vehicleListing.create({
    data: {
      userId: user.id,
      country: parsed.data.country,
      city: parsed.data.city,
      make: parsed.data.make,
      model: parsed.data.model,
      year: parsed.data.year,
      currency: parsed.data.currency,
      estimateAmount: estimate.amount,
      estimateLow: estimate.low,
      estimateHigh: estimate.high,
      estimateCount: estimate.count,
      askingAmount: parsed.data.askingAmount,
      note: parsed.data.note,
    },
    select: { id: true },
  });
  revalidatePath('/salj-bil');
  revalidatePath('/bilar-till-salu');
  return { ok: true, estimate, listingId: listing.id };
}

export async function sendVehicleMessage(input: unknown): Promise<SaleActionResult> {
  const user = await signedInUser();
  if (!canUseVehicleChat(user)) return { ok: false, error: 'auth' };
  if (!user) return { ok: false, error: 'auth' };
  const parsed = vehicleThreadSchema.safeParse(input);
  if (!parsed.success) {
    const identifier = parsed.error.issues.some((issue) => issue.message === 'identifier');
    return { ok: false, error: identifier ? 'identifier' : 'invalid' };
  }
  const listing = await prisma.vehicleListing.findUnique({
    where: { id: parsed.data.listingId },
    select: { id: true, userId: true, make: true, model: true, city: true },
  });
  if (!listing) return { ok: false, error: 'invalid' };
  const existing = parsed.data.conversationId
    ? await prisma.vehicleConversation.findUnique({
        where: { id: parsed.data.conversationId },
        select: { id: true, listingId: true, buyerUserId: true, sellerUserId: true },
      })
    : await prisma.vehicleConversation.findUnique({
        where: { listingId_buyerUserId: { listingId: listing.id, buyerUserId: user.id } },
        select: { id: true, listingId: true, buyerUserId: true, sellerUserId: true },
      });
  if (existing && existing.listingId !== listing.id) return { ok: false, error: 'invalid' };
  const decision = vehiclePostDecision({
    userId: user.id,
    listingOwnerId: listing.userId,
    conversation: existing,
  });
  if (decision === 'forbidden') return { ok: false, error: 'own' };
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const sent = await prisma.vehicleMessage.count({
    where: { senderId: user.id, createdAt: { gte: since } },
  });
  if (sent >= 40) return { ok: false, error: 'limit' };
  const now = new Date();
  let conversation = existing;
  if (!conversation) {
    try {
      conversation = await prisma.vehicleConversation.create({
        data: {
          listingId: listing.id,
          buyerUserId: user.id,
          sellerUserId: listing.userId,
          lastMessageAt: now,
        },
        select: { id: true, listingId: true, buyerUserId: true, sellerUserId: true },
      });
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002'))
        throw error;
      conversation = await prisma.vehicleConversation.findUnique({
        where: { listingId_buyerUserId: { listingId: listing.id, buyerUserId: user.id } },
        select: { id: true, listingId: true, buyerUserId: true, sellerUserId: true },
      });
    }
  }
  if (!conversation) return { ok: false, error: 'invalid' };
  await prisma.vehicleMessage.create({
    data: { conversationId: conversation.id, senderId: user.id, body: parsed.data.body },
  });
  await prisma.vehicleConversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now },
  });
  const otherId =
    user.id === conversation.buyerUserId ? conversation.sellerUserId : conversation.buyerUserId;
  const other = await prisma.user.findUnique({ where: { id: otherId }, select: { email: true } });
  if (other?.email) {
    const url = absoluteUrl(`/bilar-till-salu/${listing.id}`);
    const text = [
      `${user.name} skrev om ${listing.make} ${listing.model} i ${listing.city}.`,
      'Svara på DriveLinkUp.',
      url,
    ].join('\n');
    try {
      await sendEmail({
        to: other.email,
        subject: `Nytt meddelande om ${listing.make} ${listing.model}`,
        html: `<p>${escapeHtml(text).replaceAll('\n', '<br>')}</p>`,
        text,
      });
    } catch {
      // The message is already stored in the thread.
    }
  }
  revalidatePath(`/bilar-till-salu/${listing.id}`);
  revalidatePath('/dashboard/messages');
  revalidatePath('/dashboard/admin/conversations');
  return {
    ok: true,
    estimate: { currency: '', amount: null, low: null, high: null, count: 0, buyers: [] },
  };
}
