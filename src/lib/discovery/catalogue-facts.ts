// Resolves a click to a published row. An id that is not in the catalogue is ignored.
import 'server-only';
import { prisma } from '@/lib/db';
import type { CatalogueName, Rankable } from '@/lib/discovery/catalogue-rank';
import { publishedCars } from '@/lib/discovery/dealerships';
import { publishedInspections } from '@/lib/discovery/inspections';
import { publishedLeases } from '@/lib/discovery/leasing';
import { publishedParking } from '@/lib/discovery/parking';
import { listParts } from '@/lib/discovery/parts';
import { publishedTaxiTraining } from '@/lib/discovery/taxi-training';
import { publishedTires } from '@/lib/discovery/tires';

function checkedAtOf(row: object): string | null {
  const value = (row as { checkedAt?: unknown }).checkedAt;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function fromRows(
  rows: readonly {
    id: string;
    currency: string;
    amount: number;
    country: string;
    checkedAt: string | null;
  }[],
): Map<string, Rankable> {
  return new Map(rows.map((row) => [row.id, row]));
}

const tables: Record<Exclude<CatalogueName, 'school'>, () => Map<string, Rankable>> = {
  lease: () =>
    fromRows(
      publishedLeases().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.amount,
        country: row.country,
        checkedAt: checkedAtOf(row),
      })),
    ),
  tire: () =>
    fromRows(
      publishedTires().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.amount,
        country: row.country,
        checkedAt: checkedAtOf(row),
      })),
    ),
  taxi: () =>
    fromRows(
      publishedTaxiTraining().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.amount,
        country: row.country,
        checkedAt: checkedAtOf(row),
      })),
    ),
  parking: () =>
    fromRows(
      publishedParking().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.amount,
        country: row.country,
        checkedAt: checkedAtOf(row),
      })),
    ),
  inspection: () =>
    fromRows(
      publishedInspections().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.amount,
        country: row.country,
        checkedAt: checkedAtOf(row),
      })),
    ),
  part: () =>
    fromRows(
      listParts().map((row) => ({
        id: row.id,
        currency: row.currency,
        amount: row.price,
        country: row.sellerCountry,
        checkedAt: checkedAtOf(row),
      })),
    ),
  car: () =>
    fromRows(
      publishedCars().map((row) => ({
        id: row.id,
        currency: row.vehicle.currency,
        amount: row.vehicle.price,
        country: row.dealerCountry,
        checkedAt: checkedAtOf(row),
      })),
    ),
};

export async function publishedRankable(
  catalogue: CatalogueName,
  itemId: string,
): Promise<Rankable | null> {
  if (catalogue === 'school') {
    try {
      const school = await prisma.instructor.findUnique({
        where: { id: itemId },
        select: { id: true },
      });
      return school
        ? { id: school.id, currency: 'SEK', amount: null, country: 'SE', checkedAt: null }
        : null;
    } catch {
      return null;
    }
  }
  return tables[catalogue]().get(itemId) ?? null;
}
