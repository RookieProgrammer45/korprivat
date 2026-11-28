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

export type PublicListing = {
  id: string;
  country: string;
  city: string;
  make: string;
  model: string;
  year: number | null;
  currency: string;
  estimateAmount: number | null;
  estimateLow: number | null;
  estimateHigh: number | null;
  estimateCount: number;
  askingAmount: number | null;
  note: string | null;
  createdAt: Date;
};

export async function listPublicListings(): Promise<PublicListing[]> {
  try {
    return await prisma.vehicleListing.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        currency: true,
        estimateAmount: true,
        estimateLow: true,
        estimateHigh: true,
        estimateCount: true,
        askingAmount: true,
        note: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}

export async function findPublicListing(
  id: string,
): Promise<(PublicListing & { userId: string }) | null> {
  try {
    return await prisma.vehicleListing.findUnique({
      where: { id },
      select: {
        id: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        currency: true,
        estimateAmount: true,
        estimateLow: true,
        estimateHigh: true,
        estimateCount: true,
        askingAmount: true,
        note: true,
        createdAt: true,
        userId: true,
      },
    });
  } catch (error) {
    if (missingTable(error)) return null;
    throw error;
  }
}

export async function listOwnerListings(userId: string): Promise<PublicListing[]> {
  try {
    return await prisma.vehicleListing.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        country: true,
        city: true,
        make: true,
        model: true,
        year: true,
        currency: true,
        estimateAmount: true,
        estimateLow: true,
        estimateHigh: true,
        estimateCount: true,
        askingAmount: true,
        note: true,
        createdAt: true,
      },
    });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}
