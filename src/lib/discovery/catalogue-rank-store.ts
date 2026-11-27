// Reads and updates the learned catalogue model. A slow or missing database
// returns the empty model, which keeps the published price order.
import 'server-only';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import {
  type CatalogueModel,
  type CatalogueName,
  EMPTY_MODEL,
  type Rankable,
  rankCatalogue,
} from '@/lib/discovery/catalogue-rank';

const CACHE_MS = 5 * 60 * 1000;
const READ_BUDGET_MS = 80;

const cache = new Map<string, { at: number; model: CatalogueModel }>();

function asWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function asModel(row: {
  samples: number;
  sameCountry: number;
  fresh: number;
  bias: unknown;
}): CatalogueModel {
  const bias: Record<string, number> = {};
  if (row.bias && typeof row.bias === 'object' && !Array.isArray(row.bias)) {
    for (const [id, value] of Object.entries(row.bias)) {
      if (typeof value === 'number' && Number.isFinite(value)) bias[id] = value;
    }
  }
  return {
    samples: row.samples,
    sameCountry: asWeight(row.sameCountry),
    fresh: asWeight(row.fresh),
    bias,
  };
}

export async function visitorCountryCode(): Promise<string> {
  try {
    const headerStore = await headers();
    const code = headerStore.get('x-vercel-ip-country')?.trim().toUpperCase() ?? '';
    return /^[A-Z]{2}$/.test(code) ? code : '';
  } catch {
    return '';
  }
}

export async function loadCatalogueModel(catalogue: CatalogueName): Promise<CatalogueModel> {
  const hit = cache.get(catalogue);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.model;
  try {
    const pending = prisma.catalogueRankModel.findUnique({ where: { id: catalogue } });
    const row = await Promise.race([
      pending,
      new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), READ_BUDGET_MS)),
    ]);
    if (row === undefined) return hit?.model ?? EMPTY_MODEL;
    const model = row ? asModel(row) : EMPTY_MODEL;
    cache.set(catalogue, { at: Date.now(), model });
    return model;
  } catch {
    return hit?.model ?? EMPTY_MODEL;
  }
}

export async function saveCatalogueModel(
  catalogue: CatalogueName,
  model: CatalogueModel,
): Promise<void> {
  cache.set(catalogue, { at: Date.now(), model });
  try {
    await prisma.catalogueRankModel.upsert({
      where: { id: catalogue },
      create: {
        id: catalogue,
        samples: model.samples,
        sameCountry: model.sameCountry,
        fresh: model.fresh,
        bias: model.bias,
      },
      update: {
        samples: model.samples,
        sameCountry: model.sameCountry,
        fresh: model.fresh,
        bias: model.bias,
      },
    });
  } catch {
    cache.delete(catalogue);
  }
}

export async function orderCatalogue<T>(
  catalogue: CatalogueName,
  rows: readonly T[],
  item: (row: T) => Rankable,
): Promise<T[]> {
  const [model, country] = await Promise.all([loadCatalogueModel(catalogue), visitorCountryCode()]);
  return rankCatalogue(rows, item, model, country, Date.now());
}
