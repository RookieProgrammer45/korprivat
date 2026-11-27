// One opened published listing updates the catalogue model. Analytics consent
// is required. An unknown id is ignored, so the model cannot invent a row.
import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ConsentState } from '@/lib/contracts/consent';
import { publishedRankable } from '@/lib/discovery/catalogue-facts';
import { isCatalogueName, learnClick } from '@/lib/discovery/catalogue-rank';
import {
  loadCatalogueModel,
  saveCatalogueModel,
  visitorCountryCode,
} from '@/lib/discovery/catalogue-rank-store';
import { clientIp, rateLimitResponse, takeIpToken } from '@/lib/http/ip-rate-limit';

export const dynamic = 'force-dynamic';

const Body = z.object({
  catalogue: z.string().min(1).max(32),
  itemId: z.string().min(1).max(500),
});

async function analyticsConsent(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get('dl_consent_v1')?.value;
  if (!raw) return false;
  try {
    const parsed = ConsentState.safeParse(JSON.parse(Buffer.from(raw, 'base64').toString('utf8')));
    return parsed.success && parsed.data.scope.analytics === true;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const limited = takeIpToken(`catalogue-rank:${clientIp(request.headers)}`, { max: 60 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);
  if (!(await analyticsConsent())) return new NextResponse(null, { status: 204 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success || !isCatalogueName(parsed.data.catalogue)) {
    return new NextResponse(null, { status: 204 });
  }

  const item = await publishedRankable(parsed.data.catalogue, parsed.data.itemId);
  if (!item) return new NextResponse(null, { status: 204 });

  const [model, country] = await Promise.all([
    loadCatalogueModel(parsed.data.catalogue),
    visitorCountryCode(),
  ]);
  await saveCatalogueModel(parsed.data.catalogue, learnClick(model, item, country, Date.now()));
  return new NextResponse(null, { status: 204 });
}
