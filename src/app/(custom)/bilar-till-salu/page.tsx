import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LocaleLink } from '@/components/locale-link';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { localePath } from '@/lib/seo/locale-path';
import { siteName } from '@/lib/site';
import { listPublicListings } from '@/lib/vehicle-sales/listings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('carsForSalePage.meta');
  const locale = await getLocale();
  const title = t('title');
  const description = t('description');
  return {
    title,
    description,
    alternates: await publicAlternatesFor('/bilar-till-salu'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl(localePath(locale, '/bilar-till-salu')),
    },
  };
}

function money(locale: string, currency: string, amount: number): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

export default async function CarsForSalePage() {
  const t = await getTranslations('carsForSalePage');
  const locale = await getLocale();
  const listings = await listPublicListings();

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="font-display text-4xl tracking-tight">{t('header.title')}</h1>
      <p className="mt-3 text-muted-foreground">{t('header.lead')}</p>
      <p className="mt-4">
        <LocaleLink className="text-sm underline-offset-4 hover:underline" href="/salj-bil">
          {t('header.sell')}
        </LocaleLink>
      </p>
      {listings.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {listings.map((listing) => (
            <li key={listing.id} className="rounded-2xl border border-border p-4">
              <LocaleLink
                className="text-lg underline-offset-4 hover:underline"
                href={`/bilar-till-salu/${listing.id}`}
              >
                {listing.make} {listing.model}
                {listing.year ? ` · ${listing.year}` : ''}
              </LocaleLink>
              <p className="mt-1 text-sm text-muted-foreground">
                {listing.city} · {listing.country}
              </p>
              <p className="mt-3 font-display text-2xl tracking-tight">
                {listing.estimateAmount != null
                  ? money(locale, listing.currency, listing.estimateAmount)
                  : t('card.noEstimate')}
              </p>
              {listing.askingAmount != null ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('card.asking', {
                    amount: money(locale, listing.currency, listing.askingAmount),
                  })}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
