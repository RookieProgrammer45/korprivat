import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { countryPath, NORDIC_COUNTRIES, NORDIC_COUNTRY_META } from '@/lib/seo/nordic-locations';
import { siteName } from '@/lib/site';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('locationHub.meta');
  const title = t('indexTitle');
  const description = t('indexSubtitle');
  return {
    title,
    description,
    alternates: publicAlternates('/locations'),
    openGraph: {
      type: 'website',
      siteName,
      title: `${title} · ${siteName}`,
      description,
      url: absoluteUrl('/locations'),
    },
  };
}

export default async function LocationsIndexPage() {
  const t = await getTranslations('locationHub');
  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t('countriesTitle')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight">{t('indexTitle')}</h1>
        <p className="text-body-lg text-muted-foreground">{t('indexSubtitle')}</p>
      </header>
      <ul className="mx-auto mt-10 grid max-w-3xl gap-4">
        {NORDIC_COUNTRIES.map((code) => {
          const meta = NORDIC_COUNTRY_META[code];
          return (
            <li key={code}>
              <Link
                href={countryPath(code)}
                className="surface-card block rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <p className="font-display text-h3">{meta.nameLocal}</p>
                <p className="mt-1 text-body text-muted-foreground">{meta.name}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
