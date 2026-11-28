import 'server-only';

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseWorkshop, type Workshop } from '@/lib/discovery/workshops';

const DIRECTORY = join(process.cwd(), 'data', 'workshops');
const cache = new Map<string, { mtimeMs: number; rows: Workshop[] }>();

function readCountry(country: string): Workshop[] {
  const path = join(DIRECTORY, `${country}.json`);
  let mtimeMs = 0;
  try {
    mtimeMs = statSync(path).mtimeMs;
  } catch {
    return [];
  }
  const cached = cache.get(country);
  if (cached && cached.mtimeMs === mtimeMs) return cached.rows;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    cache.set(country, { mtimeMs, rows: [] });
    return [];
  }
  const rows =
    parsed && typeof parsed === 'object' && Array.isArray((parsed as { rows?: unknown }).rows)
      ? (parsed as { rows: unknown[] }).rows
      : [];
  const workshops = rows.flatMap((row) => {
    const workshop = parseWorkshop(country, row);
    return workshop ? [workshop] : [];
  });
  cache.set(country, { mtimeMs, rows: workshops });
  return workshops;
}

export function workshopCountries(): string[] {
  try {
    return readdirSync(DIRECTORY)
      .filter((name) => /^[A-Z]{2}\.json$/.test(name))
      .map((name) => name.slice(0, 2))
      .sort();
  } catch {
    return [];
  }
}

export function workshopsInCountry(country: string): Workshop[] {
  if (!/^[A-Z]{2}$/.test(country)) return [];
  return readCountry(country);
}
