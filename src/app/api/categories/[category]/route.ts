import 'server-only';
import { NextResponse } from 'next/server';
import {
  isCategoryOfferingsOn,
  isOfferingCategory,
} from '@/lib/acquisition/category-offering-policy';
import { listCategoryOfferings } from '@/lib/acquisition/category-offering-store';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ category: string }> }) {
  if (!isCategoryOfferingsOn())
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  const { category } = await ctx.params;
  if (!isOfferingCategory(category)) {
    return NextResponse.json({ error: { code: 'not_found' } }, { status: 404 });
  }
  const offerings = await listCategoryOfferings(category);
  return NextResponse.json({ category, offerings, bookingSurfaces: false });
}
