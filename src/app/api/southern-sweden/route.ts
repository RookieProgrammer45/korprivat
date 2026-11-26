import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { defaultLocale } from '@/i18n/config';
import { buildSouthernSwedenResponse } from '@/lib/business/southern-sweden';
import { SouthernSwedenLocale } from '@/lib/contracts/southern-sweden';
import { messageCatalogs } from '@/lib/i18n/catalogs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestedLocale = request.nextUrl.searchParams.get('locale');
  const localeResult = SouthernSwedenLocale.safeParse(requestedLocale);
  const locale = localeResult.success ? localeResult.data : defaultLocale;
  const response = buildSouthernSwedenResponse(messageCatalogs[locale].southernSwedenPage, locale);

  return NextResponse.json(response);
}
