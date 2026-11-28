import { getLocale, getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { CatalogueOutboundLink } from '@/components/custom/catalogue-outbound-link';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { TireLocation } from '@/components/custom/tire-location';
import { LocaleLink as Link } from '@/components/locale-link';
import { TIRE_PLACES, tireCityCountry } from '@/lib/discovery/tire-place';
import {
  groupTiresByCurrency,
  type PublishedTire,
  type TireFilters,
  type TireService,
  type TireVehicle,
} from '@/lib/discovery/tires';
import { intlLocale } from '@/lib/intl-locale';
import { localePath } from '@/lib/seo/locale-path';
import { tireSearchPath } from '@/lib/seo/tire-search-path';

const VEHICLES: TireVehicle[] = ['car', 'van'];
const SERVICES: TireService[] = ['change', 'hotel', 'mount', 'mobile'];
const COUNTRY_ORDER = ['SE', 'NO', 'FI', 'NL', 'GB'];

export async function TireCatalogue({
  filters,
  rows,
  countries,
}: {
  filters: TireFilters;
  rows: PublishedTire[];
  countries: string[];
}) {
  const t = await getTranslations('tirePage');
  const cities = await getTranslations('publicHome.hero.search.cities');
  const locale = await getLocale();
  const groups = groupTiresByCurrency(rows);
  const countryRank = (code: string) => {
    const index = COUNTRY_ORDER.indexOf(code);
    return index === -1 ? COUNTRY_ORDER.length : index;
  };
  const orderedCountries = [...countries].sort((a, b) => countryRank(a) - countryRank(b));
  const placeFor = (country: string | null) => {
    if (!filters.place) return null;
    if (country === filters.country || country === null) return filters.place;
    return tireCityCountry(filters.place) === country ? filters.place : null;
  };
  const hrefFor = (next: Partial<TireFilters> & { country?: string | null }) => {
    const country = next.country === undefined ? filters.country : next.country;
    return tireSearchPath({
      country,
      place: next.place === undefined ? placeFor(country) : next.place,
      vehicle: next.vehicle ?? filters.vehicle,
      service: next.service ?? filters.service,
    });
  };
  const cityChoices = TIRE_PLACES.filter(
    (city) => !filters.country || city.country === filters.country,
  );

  return (
    <section className="border-t border-border" data-tire-catalogue="">
      <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
        <div className="grid min-w-0 max-w-3xl gap-3">
          <h1 className="font-display text-h1 font-normal leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-body text-muted-foreground">{t('lead')}</p>
        </div>
        <div className="grid min-w-0 gap-4">
          <FilterRow label={t('countryLabel')}>
            <FilterLink href={hrefFor({ country: null })} current={filters.country === null}>
              {t('countryAll')}
            </FilterLink>
            {orderedCountries.map((country) => (
              <FilterLink
                key={country}
                href={hrefFor({ country })}
                current={filters.country === country}
              >
                {t(`countries.${country}`)}
              </FilterLink>
            ))}
          </FilterRow>
          <form
            action={localePath(locale, '/dack')}
            className="grid min-w-0 gap-3 rounded-[1.25rem] border border-border bg-card p-4 sm:grid-cols-[minmax(12rem,20rem)_1fr_auto] sm:items-end"
          >
            {filters.country ? (
              <input type="hidden" name="country" value={filters.country} />
            ) : null}
            {filters.vehicle !== 'car' ? (
              <input type="hidden" name="vehicle" value={filters.vehicle} />
            ) : null}
            {filters.service !== 'change' ? (
              <input type="hidden" name="service" value={filters.service} />
            ) : null}
            <label className="grid min-w-0 gap-2 text-small text-muted-foreground sm:col-span-1">
              {t('cityLabel')}
              <select
                name="place"
                defaultValue={filters.place ?? ''}
                className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground"
              >
                <option value="">{t('cityAll')}</option>
                {filters.place && !cityChoices.some((city) => city.value === filters.place) ? (
                  <option value={filters.place}>{filters.place}</option>
                ) : null}
                {cityChoices.map((city) => (
                  <option key={city.id} value={city.value}>
                    {cities(city.id)}
                  </option>
                ))}
              </select>
            </label>
            <TireLocation place={filters.place} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm text-background"
            >
              {t('filter')}
            </button>
          </form>
          <FilterRow label={t('vehicleLabel')}>
            {VEHICLES.map((vehicle) => (
              <FilterLink
                key={vehicle}
                href={hrefFor({ vehicle })}
                current={filters.vehicle === vehicle}
              >
                {t(`vehicles.${vehicle}`)}
              </FilterLink>
            ))}
          </FilterRow>
          <FilterRow label={t('serviceLabel')}>
            {SERVICES.map((service) => (
              <FilterLink
                key={service}
                href={hrefFor({ service })}
                current={filters.service === service}
              >
                {t(`services.${service}`)}
              </FilterLink>
            ))}
          </FilterRow>
        </div>
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
                    <TireCard row={row} locale={locale} />
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

async function TireCard({ row, locale }: { row: PublishedTire; locale: string }) {
  const t = await getTranslations('tirePage');
  const price = `${new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: Number.isInteger(row.amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(row.amount)} ${row.currency}`;
  const place = row.place || t(`countries.${row.country}`);

  return (
    <CatalogueOutboundLink
      catalogue="tire"
      itemId={row.id}
      href={row.sourceUrl}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
        <span className="dlu-school-photo dlu-school-photo--compact">
          <span className="flex h-full items-center justify-center font-display text-lg font-normal text-foreground">
            {row.provider.slice(0, 1)}
          </span>
        </span>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] leading-snug text-muted-foreground sm:text-small">
              {place}
            </p>
            <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
              {row.provider}
            </h3>
          </div>
          {row.priceKind === 'from' ? (
            <p className="text-small text-muted-foreground">{t('priceFrom')}</p>
          ) : null}
          {row.priceKind === 'maximum' ? (
            <p className="text-small text-foreground">{t('priceMaximum')}</p>
          ) : null}
          <p className="dlu-school-price break-words">{price}</p>
          <div className="mt-auto flex flex-col gap-2">
            <span className="dlu-chip max-w-full truncate">{t(`services.${row.service}`)}</span>
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
