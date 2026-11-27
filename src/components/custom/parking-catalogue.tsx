import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CatalogueOutboundLink } from '@/components/custom/catalogue-outbound-link';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { LocaleLink as Link } from '@/components/locale-link';
import {
  groupParkingByCurrency,
  type ParkingFilters,
  type PublishedParking,
} from '@/lib/discovery/parking';
import { intlLocale } from '@/lib/intl-locale';
import { parkingSearchPath } from '@/lib/seo/parking-search-path';

const COUNTRY_ORDER = ['SE', 'NO', 'DK', 'FI'];
const CITY_ORDER = ['stockholm', 'goteborg', 'malmo', 'oslo', 'kobenhavn', 'helsinki'];

export async function ParkingCatalogue({
  filters,
  rows,
  countries,
  cities,
}: {
  filters: ParkingFilters;
  rows: PublishedParking[];
  countries: string[];
  cities: string[];
}) {
  const t = await getTranslations('parkingPage');
  const locale = await getLocale();
  const groups = groupParkingByCurrency(rows);
  const countryRank = (code: string) => {
    const index = COUNTRY_ORDER.indexOf(code);
    return index === -1 ? COUNTRY_ORDER.length : index;
  };
  const cityRank = (slug: string) => {
    const index = CITY_ORDER.indexOf(slug);
    return index === -1 ? CITY_ORDER.length : index;
  };
  const orderedCountries = [...countries].sort((a, b) => countryRank(a) - countryRank(b));
  const orderedCities = [...cities].sort((a, b) => cityRank(a) - cityRank(b));

  return (
    <section className="border-t border-border" data-parking-catalogue="">
      <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
        <div className="grid min-w-0 max-w-3xl gap-3">
          <h1 className="font-display text-h1 font-normal leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-body text-muted-foreground">{t('lead')}</p>
        </div>
        <FilterRow label={t('countryLabel')}>
          <FilterLink
            href={parkingSearchPath({ country: null, city: null })}
            current={filters.country === null}
          >
            {t('countryAll')}
          </FilterLink>
          {orderedCountries.map((country) => (
            <FilterLink
              key={country}
              href={parkingSearchPath({ country, city: null })}
              current={filters.country === country}
            >
              {t(`countries.${country}`)}
            </FilterLink>
          ))}
        </FilterRow>
        <FilterRow label={t('cityLabel')}>
          <FilterLink
            href={parkingSearchPath({ country: filters.country, city: null })}
            current={filters.city === null}
          >
            {t('cityAll')}
          </FilterLink>
          {orderedCities.map((city) => (
            <FilterLink
              key={city}
              href={parkingSearchPath({ country: filters.country, city })}
              current={filters.city === city}
            >
              {t(`cities.${city}`)}
            </FilterLink>
          ))}
        </FilterRow>
        {rows.length === 0 ? (
          <p className="text-small text-muted-foreground">{t('empty')}</p>
        ) : (
          groups.map((group) => (
            <div key={group.currency} className="grid min-w-0 gap-4">
              {groups.length > 1 ? (
                <h2 className="font-display text-h3 font-normal tracking-tight text-foreground">
                  {t('currencyGroup', { currency: group.currency })}
                </h2>
              ) : null}
              <ul className={SCHOOL_LISTING_GRID_CLASS}>
                {group.rows.map((row) => (
                  <li key={row.id} className="h-full min-w-0">
                    <ParkingCard row={row} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-2">
      <p className="text-small text-muted-foreground">{label}</p>
      <div className="flex min-w-0 flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterLink({
  href,
  current,
  children,
}: {
  href: string;
  current: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground ${
        current
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-card text-foreground'
      }`}
    >
      {children}
    </Link>
  );
}

async function ParkingCard({ row, locale }: { row: PublishedParking; locale: string }) {
  const t = await getTranslations('parkingPage');
  const number = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Number.isInteger(row.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const price = `${number.format(row.amount)} ${row.currency}`;
  const where = [row.place, t(`cities.${row.city}`), t(`countries.${row.country}`)]
    .filter((part) => part.length > 0)
    .join(' · ');

  return (
    <CatalogueOutboundLink
      catalogue="parking"
      itemId={row.id}
      href={row.sourceUrl}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
        <span className="dlu-school-photo dlu-school-photo--compact">
          <span className="flex h-full items-center justify-center font-display text-lg font-normal text-foreground">
            {row.spot.slice(0, 1)}
          </span>
        </span>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] leading-snug text-muted-foreground sm:text-small">
              {row.provider} · {where}
            </p>
            <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
              {row.spot}
            </h3>
          </div>
          <p className="dlu-school-price break-words">{price}</p>
          <p className="text-small text-muted-foreground">{t('perHour')}</p>
          <div className="mt-auto flex flex-col gap-2">
            {row.notes.length > 0 ? (
              <p className="line-clamp-3 text-[11px] leading-snug text-muted-foreground sm:text-small">
                {row.notes.map((note) => t(`notes.${note}`)).join(' ')}
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground sm:text-small">{t('source')}</p>
          </div>
        </div>
      </article>
    </CatalogueOutboundLink>
  );
}
