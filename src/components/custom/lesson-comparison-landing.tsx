import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { SchoolListingCard } from '@/components/custom/school-listing-card';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { isLocale } from '@/i18n/config';
import { cityListingStats, publicSchoolsForLocation } from '@/lib/discovery/public-listing';
import { compareByPublishedLessonPrice } from '@/lib/discovery/published-lesson-order';
import { absoluteUrl, publicAlternatesFor } from '@/lib/seo/alternates';
import { jsonLdScript } from '@/lib/seo/json-ld';
import { isLessonComparisonEligible, lessonComparisonPath } from '@/lib/seo/lesson-comparison-path';
import { localeHreflang, localePath } from '@/lib/seo/locale-path';
import {
  countryPath,
  displayName,
  locationPath,
  NORDIC_COUNTRY_META,
  type NordicLocation,
} from '@/lib/seo/nordic-locations';
import { schoolPath } from '@/lib/seo/school-slugs';
import { siteName, siteUrl } from '@/lib/site';

function pricedSchoolsFor(location: NordicLocation) {
  return publicSchoolsForLocation(location).then((schools) =>
    schools.filter((school) => school.publishedPrices?.lesson).sort(compareByPublishedLessonPrice),
  );
}

export async function lessonComparisonMetadata(location: NordicLocation): Promise<Metadata> {
  const t = await getTranslations('lessonComparison.meta');
  const name = displayName(location);
  const path = lessonComparisonPath(location);
  const schools = await pricedSchoolsFor(location);
  if (!isLessonComparisonEligible(schools.length)) {
    return { title: t('title', { name, price: 0 }), robots: { index: false, follow: false } };
  }
  const stats = cityListingStats(schools);
  const price = stats.minLessonSek ?? 0;
  const title = t('title', { name, price });
  const description = t('description', { name, count: schools.length, price });
  const brandedTitle = `${title} · ${siteName}`;
  const locale = await getLocale();
  return {
    title,
    description,
    alternates: await publicAlternatesFor(path),
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

export async function LessonComparisonLanding({ location }: { location: NordicLocation }) {
  const t = await getTranslations('lessonComparison');
  const locale = await getLocale();
  const href = (next: string) => localePath(locale, next);
  const name = displayName(location);
  const country = NORDIC_COUNTRY_META[location.country];
  const path = lessonComparisonPath(location);
  const url = absoluteUrl(href(path));
  const schools = await pricedSchoolsFor(location);
  const stats = cityListingStats(schools);
  const minPrice = stats.minLessonSek ?? 0;
  const maxPrice = Math.max(
    ...schools.map((school) => school.publishedPrices?.lesson?.priceSek ?? 0),
  );

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: t('heading', { name, price: minPrice }),
        description: t('lead', { name, count: schools.length, price: minPrice }),
        url,
        inLanguage: isLocale(locale) ? localeHreflang[locale] : 'sv-SE',
        isPartOf: { '@type': 'WebSite', name: siteName, url: siteUrl },
        offers: {
          '@type': 'AggregateOffer',
          lowPrice: minPrice,
          highPrice: maxPrice,
          priceCurrency: 'SEK',
          offerCount: schools.length,
        },
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
          {
            '@type': 'ListItem',
            position: 4,
            name,
            item: absoluteUrl(href(locationPath(location))),
          },
          { '@type': 'ListItem', position: 5, name: t('breadcrumbLesson'), item: url },
        ],
      },
      {
        '@type': 'ItemList',
        name: t('tableCaption', { name }),
        numberOfItems: schools.length,
        itemListElement: schools.map((school, index) => {
          const lesson = school.publishedPrices?.lesson;
          return {
            '@type': 'ListItem',
            position: index + 1,
            item: {
              '@type': 'DrivingSchool',
              name: school.name,
              url: absoluteUrl(schoolPath(school)),
              ...(lesson
                ? {
                    makesOffer: {
                      '@type': 'Offer',
                      price: lesson.priceSek,
                      priceCurrency: school.publishedPrices?.currency ?? 'SEK',
                      description: lesson.minutes
                        ? t('offerMinutes', { minutes: lesson.minutes })
                        : t('offerLesson'),
                    },
                  }
                : {}),
            },
          };
        }),
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: t('faq1q', { name }),
            acceptedAnswer: { '@type': 'Answer', text: t('faq1a', { name }) },
          },
          {
            '@type': 'Question',
            name: t('faq2q'),
            acceptedAnswer: { '@type': 'Answer', text: t('faq2a') },
          },
        ],
      },
    ],
  };

  return (
    <>
      <main className="directory-shell container-page min-h-[calc(100dvh-3.5rem)] min-w-0">
        <header className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <p className="text-eyebrow">{country.nameLocal}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('heading', { name, price: minPrice })}
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            {t('lead', { name, count: schools.length, price: minPrice })}
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
            {' / '}
            <Link className="underline underline-offset-4" href={href(locationPath(location))}>
              {name}
            </Link>
          </p>
        </header>

        <section className="mx-auto mt-8 w-full max-w-6xl">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-left text-small">
              <caption className="mb-3 text-left text-body text-muted-foreground">
                <span className="mb-1 block font-display text-h3 text-foreground">
                  {t('tableTitle', { name })}
                </span>
                {t('tableCaption', { name })}
              </caption>
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('colRank')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('colSchool')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('colLesson')}
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    {t('colLength')}
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    {t('colPerMinute')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school, index) => {
                  const lesson = school.publishedPrices?.lesson;
                  if (!lesson) return null;
                  const amount = new Intl.NumberFormat(locale, {
                    style: 'currency',
                    currency: school.publishedPrices?.currency ?? 'SEK',
                    maximumFractionDigits: 0,
                  }).format(lesson.priceSek);
                  const perMinute =
                    lesson.minutes && lesson.minutes > 0
                      ? new Intl.NumberFormat(locale, {
                          style: 'currency',
                          currency: school.publishedPrices?.currency ?? 'SEK',
                          maximumFractionDigits: 1,
                        }).format(lesson.priceSek / lesson.minutes)
                      : '—';
                  return (
                    <tr key={school.id} className="border-b border-border/70">
                      <td className="py-3 pr-4 text-muted-foreground">{index + 1}</td>
                      <th scope="row" className="py-3 pr-4 font-normal">
                        <Link
                          className="underline underline-offset-4"
                          href={href(schoolPath(school))}
                        >
                          {school.name}
                        </Link>
                      </th>
                      <td className="py-3 pr-4 font-medium text-foreground">{amount}</td>
                      <td className="py-3 pr-4 text-muted-foreground">
                        {lesson.minutes ? t('minutes', { minutes: lesson.minutes }) : '—'}
                      </td>
                      <td className="py-3 text-muted-foreground">{perMinute}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-caption text-muted-foreground">{t('sourceNote')}</p>
        </section>

        <section className="mx-auto mt-10 w-full max-w-6xl">
          <h2 className="font-display text-h3">{t('cardsHeading', { name })}</h2>
          <ul className={`mt-4 ${SCHOOL_LISTING_GRID_CLASS}`}>
            {schools.map((school) => (
              <li key={school.id} className="h-full min-w-0">
                <SchoolListingCard row={school} />
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto mt-12 grid w-full max-w-6xl gap-4">
          <h2 className="font-display text-h3">{t('faqTitle')}</h2>
          <div className="grid gap-3">
            <div>
              <h3 className="font-medium text-foreground">{t('faq1q', { name })}</h3>
              <p className="mt-1 text-body text-muted-foreground">{t('faq1a', { name })}</p>
            </div>
            <div>
              <h3 className="font-medium text-foreground">{t('faq2q')}</h3>
              <p className="mt-1 text-body text-muted-foreground">{t('faq2a')}</p>
            </div>
          </div>
          <p>
            <Link className="dlu-text-link" href={href(locationPath(location))}>
              {t('backToHub', { name })}
            </Link>
          </p>
        </section>
      </main>
      {jsonLdScript(jsonLd)}
    </>
  );
}
