import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { LocationDirectory } from '@/components/custom/location-directory';
import { loginHrefWithNext } from '@/lib/auth-next';
import { nordicCountryHasSchools } from '@/lib/discovery/nordic-catalogue';
import { getSessionUser } from '@/lib/require-auth';
import { absoluteUrl, publicAlternates } from '@/lib/seo/alternates';
import { browseCities, citiesInRegion, schoolsForLocation } from '@/lib/seo/catalogue-locations';
import { marketCopy } from '@/lib/seo/market-copy';
import {
  countryPath,
  displayName,
  listRegions,
  locationPath,
  NORDIC_COUNTRY_META,
  type NordicLocation,
} from '@/lib/seo/nordic-locations';
import { schoolPath } from '@/lib/seo/school-slugs';
import { siteName, siteUrl } from '@/lib/site';

export async function locationHubMetadata(location: NordicLocation): Promise<Metadata> {
  const t = await getTranslations('locationHub.meta');
  const path = locationPath(location);
  const name = displayName(location);
  const country = NORDIC_COUNTRY_META[location.country];
  const market = marketCopy(location.country);
  const title = market
    ? location.kind === 'city'
      ? market.cityTitle(name, country.nameLocal)
      : market.countryTitle(country.nameLocal)
    : location.kind === 'city'
      ? t('titleCity', { name, country: country.nameLocal })
      : t('titleRegion', { name, country: country.nameLocal });
  const description = market
    ? location.kind === 'city'
      ? market.cityDescription(name, country.nameLocal)
      : market.countryDescription(country.nameLocal)
    : location.kind === 'city'
      ? t('descriptionCity', { name, country: country.nameLocal })
      : t('descriptionRegion', { name, country: country.nameLocal });
  const brandedTitle = `${title} · ${siteName}`;
  return {
    title,
    description,
    alternates: publicAlternates(path),
    openGraph: {
      type: 'website',
      siteName,
      title: brandedTitle,
      description,
      url: absoluteUrl(path),
    },
    twitter: { card: 'summary_large_image', title: brandedTitle, description },
  };
}

export async function LocationHubLanding({ location }: { location: NordicLocation }) {
  const t = await getTranslations('locationHub');
  const path = locationPath(location);
  const sessionUser = await getSessionUser();
  const name = displayName(location);
  const country = NORDIC_COUNTRY_META[location.country];
  const market = marketCopy(location.country);
  const url = absoluteUrl(path);
  const siblingCities =
    location.kind === 'region'
      ? citiesInRegion(location.country, location.slug)
      : location.regionSlug
        ? citiesInRegion(location.country, location.regionSlug).filter(
            (c) => c.slug !== location.slug,
          )
        : [];
  const regions = listRegions(location.country);
  const schools = location.kind === 'city' ? schoolsForLocation(location) : [];
  const catalogueHere = schools.length > 0;
  const countryCatalogue = location.country !== 'se' && nordicCountryHasSchools(location.country);
  const showLiveDirectory = location.marketplaceLive && Boolean(location.filterCity);
  const directoryCity = location.filterCity ?? null;
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
        inLanguage: market?.schemaLang ?? 'sv-SE',
        isPartOf: { '@type': 'WebSite', name: siteName, url: `${siteUrl}/` },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: siteName, item: `${siteUrl}/` },
          {
            '@type': 'ListItem',
            position: 2,
            name: t('breadcrumbLocations'),
            item: `${siteUrl}/locations`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: country.nameLocal,
            item: absoluteUrl(countryPath(location.country)),
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
            <Link className="underline underline-offset-4" href="/locations">
              {t('breadcrumbLocations')}
            </Link>
            {' / '}
            <Link className="underline underline-offset-4" href={countryPath(location.country)}>
              {country.nameLocal}
            </Link>
          </p>
        </header>

        {schools.length > 0 ? (
          <section lang={market?.htmlLang} className="mx-auto mt-8 w-full max-w-6xl">
            <h2 className="font-display text-h3">{market?.listHeading ?? t('citiesTitle')}</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {schools.map((school) => {
                const codes = [
                  ...school.categories,
                  ...(school.publishedPrices?.heavy?.categories ?? []),
                ];
                const lesson = school.publishedPrices?.lesson;
                const currency = school.publishedPrices?.currency ?? 'SEK';
                const price = lesson ? `${lesson.priceSek} ${currency}` : null;
                return (
                  <li
                    key={school.id}
                    className="rounded-[1.25rem] border border-border bg-card p-4"
                  >
                    <Link
                      className="font-display text-body text-foreground underline-offset-4 hover:underline"
                      href={schoolPath(school)}
                    >
                      {school.name}
                    </Link>
                    {codes.length > 0 || price ? (
                      <p className="mt-1 text-small text-muted-foreground">
                        {[codes.join(' · '), price].filter(Boolean).join(' · ')}
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {showLiveDirectory && directoryCity ? (
          sessionUser ? (
            <LocationDirectory cityName={directoryCity} />
          ) : (
            <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
              <h2 className="font-display text-h3">{t('signInTitle')}</h2>
              <p className="text-body text-muted-foreground">{t('signInBody')}</p>
              <p>
                <Link className="dlu-ink-pill inline-flex" href={loginHrefWithNext(path)}>
                  {t('signInCta')}
                </Link>
              </p>
            </section>
          )
        ) : schools.length > 0 ? null : countryCatalogue ? (
          <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-h3">{t('citiesTitle')}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {(location.kind === 'region'
                ? browseCities(location.country, location.slug)
                : []
              ).map((c) => (
                <li key={c.slug}>
                  <Link className="underline underline-offset-4" href={locationPath(c)}>
                    {displayName(c)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <section className="mx-auto mt-8 grid w-full max-w-6xl gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-h3">{t('expansionTitle')}</h2>
            <p className="text-body text-muted-foreground">{t('expansionBody')}</p>
            <p>
              <Link className="underline underline-offset-4" href="/instructors">
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
                  <Link className="underline underline-offset-4" href={locationPath(c)}>
                    {displayName(c)}
                  </Link>
                </li>
              ))}
              {siblingCities.length === 0
                ? regions.slice(0, 8).map((r) => (
                    <li key={r.slug}>
                      <Link className="underline underline-offset-4" href={locationPath(r)}>
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
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </>
  );
}
