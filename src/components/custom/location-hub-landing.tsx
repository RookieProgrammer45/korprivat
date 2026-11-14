import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { SchoolListingCard } from '@/components/custom/school-listing-card';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { isLocale } from '@/i18n/config';
import { nordicCountryHasSchools } from '@/lib/discovery/nordic-catalogue';
import { cityListingStats, publicSchoolsForLocation } from '@/lib/discovery/public-listing';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import {
  browseCities,
  citiesInRegion,
  isIndexableLocation,
  schoolsForLocation,
} from '@/lib/seo/catalogue-locations';
import { jsonLdScript } from '@/lib/seo/json-ld';
import { localeHreflang, localePath } from '@/lib/seo/locale-path';
import { marketCopy } from '@/lib/seo/market-copy';
import {
  countryPath,
  displayName,
  listRegions,
  locationPath,
  NORDIC_COUNTRY_META,
  type NordicLocation,
} from '@/lib/seo/nordic-locations';
import { heroCategoryMatches, parseHeroSearchCategory } from '@/lib/seo/school-search-path';
import { schoolPath } from '@/lib/seo/school-slugs';
import { siteName, siteUrl } from '@/lib/site';

export async function locationHubMetadata(
  location: NordicLocation,
  category?: string | null,
): Promise<Metadata> {
  const t = await getTranslations('locationHub.meta');
  const path = locationPath(location);
  const name = displayName(location);
  const country = NORDIC_COUNTRY_META[location.country];
  const market = marketCopy(location.country);
  const licence = parseHeroSearchCategory(category);
  const schools = (await publicSchoolsForLocation(location)).filter((school) =>
    heroCategoryMatches(school.categories, licence),
  );
  const stats = cityListingStats(schools);
  const title = market
    ? location.kind === 'city'
      ? market.cityTitle(name, country.nameLocal)
      : market.countryTitle(country.nameLocal)
    : location.kind === 'city'
      ? stats.count > 0
        ? t('titleCityCounted', { name, country: country.nameLocal, count: stats.count })
        : t('titleCity', { name, country: country.nameLocal })
      : t('titleRegion', { name, country: country.nameLocal });
  const description = market
    ? location.kind === 'city'
      ? market.cityDescription(name, country.nameLocal)
      : market.countryDescription(country.nameLocal)
    : location.kind === 'city'
      ? stats.minLessonSek
        ? t('descriptionCityPriced', {
            name,
            country: country.nameLocal,
            count: stats.count,
            price: stats.minLessonSek,
          })
        : stats.count > 0
          ? t('descriptionCityCounted', {
              name,
              country: country.nameLocal,
              count: stats.count,
            })
          : t('descriptionCity', { name, country: country.nameLocal })
      : t('descriptionRegion', { name, country: country.nameLocal });
  const brandedTitle = `${title} · ${siteName}`;
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor(path),
    ...(isIndexableLocation(location) ? {} : { robots: { index: false, follow: true } }),
    openGraph: {
      type: 'website',
      locale: (isLocale(locale) ? localeHreflang[locale] : localeHreflang.sv).replace('-', '_'),
      siteName,
      title: brandedTitle,
      description,
      url: absoluteUrl(localePath(locale, path)),
    },
    twitter: { card: 'summary_large_image', title: brandedTitle, description },
  };
}

export async function LocationHubLanding({
  location,
  category,
}: {
  location: NordicLocation;
  category?: string | null;
}) {
  const t = await getTranslations('locationHub');
  const locale = await getLocale();
  const href = (next: string) => localePath(locale, next);
  const path = locationPath(location);
  const name = displayName(location);
  const country = NORDIC_COUNTRY_META[location.country];
  const market = marketCopy(location.country);
  const url = absoluteUrl(href(path));
  const siblingCities =
    location.kind === 'region'
      ? citiesInRegion(location.country, location.slug)
      : location.regionSlug
        ? citiesInRegion(location.country, location.regionSlug).filter(
            (c) => c.slug !== location.slug,
          )
        : [];
  const regions = listRegions(location.country);
  const licence = parseHeroSearchCategory(category);
  const schools = (await publicSchoolsForLocation(location)).filter((school) =>
    heroCategoryMatches(school.categories, licence),
  );
  const stats = cityListingStats(schools);
  const catalogueHere = location.kind === 'city' && schoolsForLocation(location).length > 0;
  const countryCatalogue = location.country !== 'se' && nordicCountryHasSchools(location.country);
  const showLiveDirectory = location.marketplaceLive && Boolean(location.filterCity);
  const heading = market
    ? location.kind === 'city'
      ? market.cityHeading(name)
      : market.countryHeading(country.nameLocal)
    : null;
  const lead = market
    ? location.kind === 'city'
      ? market.cityLead(name)
      : market.countryDescription(country.nameLocal)
    : null;

  const faq = market
    ? [{ q: market.faqQ, a: market.faqA }]
    : [
        {
          q: t('faq1q', { name }),
          a: showLiveDirectory ? t('faq1aLive', { name }) : t('faq1aExpansion'),
        },
        { q: t('faq2q'), a: t('faq2a') },
        { q: t('faq3q'), a: t('faq3a') },
      ];

  const tMeta = await getTranslations('locationHub.meta');
  const pageDescription = market
    ? location.kind === 'city'
      ? market.cityDescription(name, country.nameLocal)
      : market.countryDescription(country.nameLocal)
    : location.kind === 'city'
      ? tMeta('descriptionCity', { name, country: country.nameLocal })
      : tMeta('descriptionRegion', { name, country: country.nameLocal });

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name:
          heading ??
          t(location.kind === 'city' ? 'headerTitleCity' : 'headerTitleRegion', { name }),
        description: pageDescription,
        url,
        inLanguage: market?.schemaLang ?? (isLocale(locale) ? localeHreflang[locale] : 'sv-SE'),
        isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: absoluteUrl(href('/')) },
          {
            '@type': 'ListItem',
            position: 2,
            name: t('breadcrumbLocations'),
            item: absoluteUrl(href('/locations')),
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: country.nameLocal,
            item: absoluteUrl(href(countryPath(location.country))),
          },
          { '@type': 'ListItem', position: 4, name, item: url },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      },
      ...(schools.length > 0
        ? [
            {
              '@type': 'ItemList',
              name: heading ?? name,
              numberOfItems: schools.length,
              itemListElement: schools.map((school, index) => ({
                '@type': 'ListItem',
                position: index + 1,
                name: school.name,
                url: absoluteUrl(schoolPath(school)),
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <main className="directory-shell container-page min-h-[calc(100dvh-3.5rem)] min-w-0">
        <header lang={market?.htmlLang} className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <p className="text-eyebrow">{t('eyebrow', { country: country.nameLocal })}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {heading ??
              t(location.kind === 'city' ? 'headerTitleCity' : 'headerTitleRegion', { name })}
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            {lead
              ? lead
              : location.marketplaceLive
                ? t('subtitleLive', { name })
                : catalogueHere
                  ? t('subtitleCatalogue', { name })
                  : countryCatalogue
                    ? t('subtitleCountryCatalogue', { name })
                    : t('subtitleExpansion', { name, country: country.nameLocal })}
          </p>
          <p className="text-small text-muted-foreground">
            <Link className="underline underline-offset-4" href={href('/locations')}>
              {t('breadcrumbLocations')}
            </Link>
            {' / '}
            <Link
              className="underline underline-offset-4"
              href={href(countryPath(location.country))}
            >
              {country.nameLocal}
            </Link>
          </p>
        </header>

        {schools.length > 0 ? (
          <section lang={market?.htmlLang} className="mx-auto mt-8 w-full max-w-6xl">
            <h2 className="font-display text-h3">
              {market?.listHeading ?? t('listHeadingLive', { name })}
            </h2>
            {stats.count > 0 ? (
              <p className="mt-2 text-small text-muted-foreground">
                {[
                  t('statsCount', { count: stats.count, name }),
                  stats.minLessonSek ? t('statsPriceFrom', { price: stats.minLessonSek }) : null,
                  stats.typicalMinutes
                    ? t('statsDuration', { minutes: stats.typicalMinutes })
                    : null,
                  stats.latestCollectedAt
                    ? t('statsUpdated', {
                        date: formatCollectedDate(stats.latestCollectedAt),
                      })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            ) : null}
            <ul className={`mt-4 ${SCHOOL_LISTING_GRID_CLASS}`}>
              {schools.map((school) => (
                <li key={school.id} className="h-full min-w-0">
                  <SchoolListingCard row={school} />
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {schools.length > 0 ? null : licence ? (
          <p className="mx-auto mt-8 w-full max-w-6xl text-body text-muted-foreground">
            {t('filteredEmpty', { name })}
          </p>
        ) : countryCatalogue ? (
          <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-h3">{t('citiesTitle')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(location.kind === 'region'
                ? browseCities(location.country, location.slug)
                : []
              ).map((c) => (
                <li key={c.slug}>
                  <Link className="underline underline-offset-4" href={href(locationPath(c))}>
                    {displayName(c)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : showLiveDirectory ? (
          <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-h3">{t('emptyLiveTitle', { name })}</h2>
            <p className="text-body text-muted-foreground">{t('emptyLiveBody', { name })}</p>
            <p>
              <Link className="underline underline-offset-4" href={href('/locations')}>
                {t('expansionCtaSweden')}
              </Link>
            </p>
          </section>
        ) : (
          <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-h3">{t('expansionTitle')}</h2>
            <p className="text-body text-muted-foreground">{t('expansionBody')}</p>
            <p>
              <Link className="underline underline-offset-4" href={href('/locations')}>
                {t('expansionCtaSweden')}
              </Link>
            </p>
          </section>
        )}
      </main>

      <section className="container-page border-t border-border/60 bg-muted/20 py-section">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {market ? null : (
            <div className="grid gap-4 text-body">
              <h2 className="font-display text-h3 leading-tight">
                {t('seoLead', { name, country: country.nameLocal })}
              </h2>
              <p className="text-muted-foreground">
                {location.marketplaceLive
                  ? t('seoP1Live', { name })
                  : catalogueHere || countryCatalogue
                    ? t('seoP1Catalogue', { name })
                    : t('seoP1Expansion', { name, country: country.nameLocal })}
              </p>
              <p className="text-muted-foreground">{t('seoP2')}</p>
              <h3 className="font-display text-h4">{t('howTitle')}</h3>
              <p className="text-muted-foreground">
                {showLiveDirectory || countryCatalogue ? t('howBodyLive') : t('howBodyExpansion')}
              </p>
            </div>
          )}
          <aside className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-display text-h4">{t('nearbyTitle')}</h3>
            <ul className="grid gap-2 text-body">
              {siblingCities.slice(0, 12).map((c) => (
                <li key={c.slug}>
                  <Link className="underline underline-offset-4" href={href(locationPath(c))}>
                    {displayName(c)}
                  </Link>
                </li>
              ))}
              {siblingCities.length === 0
                ? regions.slice(0, 8).map((r) => (
                    <li key={r.slug}>
                      <Link className="underline underline-offset-4" href={href(locationPath(r))}>
                        {displayName(r)}
                      </Link>
                    </li>
                  ))
                : null}
            </ul>
            <h3 className="mt-2 font-display text-h4">{t('faqTitle')}</h3>
            <dl className="grid gap-3 text-small">
              {faq.map((item) => (
                <div key={item.q} className="grid gap-1">
                  <dt className="font-medium text-foreground">{item.q}</dt>
                  <dd className="text-muted-foreground">{item.a}</dd>
                </div>
              ))}
            </dl>
            <ul className="mt-2 grid gap-2 text-small">
              <li>
                <Link className="underline underline-offset-4" href="/handledare">
                  {t('linkHandledare')}
                </Link>
              </li>
              <li>
                <Link className="underline underline-offset-4" href="/pricing">
                  {t('linkPricing')}
                </Link>
              </li>
              <li>
                <Link className="underline underline-offset-4" href="/blog">
                  {t('linkBlog')}
                </Link>
              </li>
            </ul>
          </aside>
        </div>
      </section>
      {jsonLdScript(jsonLd)}
    </>
  );
}

function formatCollectedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('sv-SE', {
    dateStyle: 'medium',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
