import 'server-only';
import { type NextRequest, NextResponse } from 'next/server';
import { defaultLocale } from '@/i18n/config';
import { buildWesternNorthernSwedenResponse } from '@/lib/business/western-northern-sweden';
import { WesternNorthernSwedenLocale } from '@/lib/contracts/western-northern-sweden';
import { messageCatalogs } from '@/lib/i18n/catalogs';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestedLocale = request.nextUrl.searchParams.get('locale');
  const localeResult = WesternNorthernSwedenLocale.safeParse(requestedLocale);
  const locale = localeResult.success ? localeResult.data : defaultLocale;
  const response = buildWesternNorthernSwedenResponse(
    messageCatalogs[locale].westernNorthernSwedenPage,
    locale,
  );

  return NextResponse.json(response);
}
