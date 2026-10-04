import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import {
  NORDIC_COUNTRIES,
  NORDIC_COUNTRY_META,
  countryPath,
  displayName,
  isNordicCountry,
  listRegions,
  listLocationsForCountry,
  locationPath,
} from '@/lib/seo/nordic-locations';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ country: string }> };

export function generateStaticParams() {
  return NORDIC_COUNTRIES.map((country) => ({ country }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  if (!isNordicCountry(country)) return { title: 'Not found' };
  const meta = NORDIC_COUNTRY_META[country];
  const t = await getTranslations('locationHub.meta');
  const path = countryPath(country);
  const title = t('titleCountry', { country: meta.nameLocal });
  const description = t('descriptionCountry', { country: meta.nameLocal });
  return {
    title,
    description,
    alternates: publicAlternates(path),
    openGraph: {
      type: 'website',
      siteName,
      title,
      description,
      url: absoluteUrl(path),
    },
  };
}

export default async function CountryLocationsPage({ params }: Props) {
  const { country } = await params;
  if (!isNordicCountry(country)) notFound();
  const meta = NORDIC_COUNTRY_META[country];
  const t = await getTranslations('locationHub');
  const regions = listRegions(country);
  const cities = listLocationsForCountry(country).filter((l) => l.kind === 'city');

  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">
          <Link className="underline underline-offset-4" href="/locations">
            {t('breadcrumbLocations')}
          </Link>
        </p>
        <h1 className="font-display text-h1 leading-tight tracking-tight">
          {t('headerTitleCountry', { name: meta.nameLocal })}
        </h1>
        <p className="text-body-lg text-muted-foreground">
          {country === 'se'
            ? t('subtitleCountryLive', { name: meta.nameLocal })
            : t('subtitleCountryExpansion', { name: meta.nameLocal })}
        </p>
      </header>

      <section className="mx-auto mt-10 grid max-w-3xl gap-6">
        <div>
          <h2 className="font-display text-h3">{t('regionsTitle')}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {regions.map((r) => (
              <li key={r.slug}>
                <Link className="underline underline-offset-4" href={locationPath(r)}>
                  {displayName(r)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-h3">{t('citiesTitle')}</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {cities.map((c) => (
              <li key={c.slug}>
                <Link className="underline underline-offset-4" href={locationPath(c)}>
                  {displayName(c)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
