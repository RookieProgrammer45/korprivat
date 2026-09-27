// This is the locale-change lane because Server Actions ('use server') are banned.
import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { isLocale } from '@/i18n/config';
import { LOCALE_COOKIE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const locale = body?.locale;
  if (typeof locale !== 'string' || !isLocale(locale)) {
    return NextResponse.json({ errors: { locale: 'Unknown locale' } }, { status: 400 });
  }

  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: ONE_YEAR_SECONDS,
    sameSite: 'lax',
  });

  return NextResponse.json({ locale }, { status: 200 });
}
