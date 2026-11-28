import { getLocale, getTranslations } from 'next-intl/server';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { LocaleLink as Link } from '@/components/locale-link';
import {
  WORKSHOP_CITY_UNKNOWN,
  type Workshop,
  type WorkshopFilters,
  workshopAddress,
} from '@/lib/discovery/workshops';
import { intlLocale } from '@/lib/intl-locale';
import { localePath } from '@/lib/seo/locale-path';

export async function WorkshopCatalogue({
  filters,
  countries,
  cities,
  unknown,
  rows,
  total,
  pages,
}: {
  filters: WorkshopFilters;
  countries: readonly string[];
  cities: readonly string[];
  unknown: boolean;
  rows: readonly Workshop[];
  total: number;
  pages: number;
}) {
  const t = await getTranslations('workshopPage');
  const locale = await getLocale();
  const regions = new Intl.DisplayNames([intlLocale(locale)], { type: 'region' });
  const chosen = filters.city !== null;
  const page = Math.min(filters.page, pages);

  function hrefFor(next: { city?: string | null; page?: number }): string {
    const search = new URLSearchParams();
    if (filters.country) search.set('country', filters.country);
    const city = next.city === undefined ? filters.city : next.city;
    if (city) search.set('city', city);
    const pageNumber = next.page ?? 1;
    if (pageNumber > 1) search.set('page', String(pageNumber));
    const query = search.toString();
    return localePath(locale, query ? `/verkstad?${query}` : '/verkstad');
  }

  return (
    <section className="border-t border-border" data-workshop-catalogue="">
      <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
        <div className="grid min-w-0 max-w-3xl gap-3">
          <h1 className="font-display text-h1 font-normal leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-body text-muted-foreground">{t('lead')}</p>
          <p className="text-small text-muted-foreground">{t('sourceNote')}</p>
        </div>
        <form
          action={localePath(locale, '/verkstad')}
          className="grid min-w-0 gap-3 rounded-[1.25rem] border border-border bg-card p-4 sm:grid-cols-[minmax(12rem,16rem)_minmax(12rem,20rem)_auto] sm:items-end"
        >
          <label className="grid min-w-0 gap-2 text-small text-muted-foreground">
            {t('countryLabel')}
            <select
              name="country"
              defaultValue={filters.country ?? ''}
              className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground"
            >
              {countries.map((country) => (
                <option key={country} value={country}>
                  {regions.of(country) ?? country}
                </option>
              ))}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-small text-muted-foreground">
            {t('cityLabel')}
            <select
              name="city"
              defaultValue={filters.city ?? ''}
              className="min-h-11 rounded-full border border-border bg-card px-4 text-sm text-foreground"
            >
              <option value="">{t('cityAll')}</option>
              {unknown ? <option value={WORKSHOP_CITY_UNKNOWN}>{t('cityUnknown')}</option> : null}
              {filters.city &&
              filters.city !== WORKSHOP_CITY_UNKNOWN &&
              !cities.some((city) => city === filters.city) ? (
                <option value={filters.city}>{filters.city}</option>
              ) : null}
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-foreground bg-foreground px-4 text-sm text-background"
          >
            {t('filter')}
          </button>
        </form>
        {!chosen ? (
          <p className="text-small text-muted-foreground">{t('chooseCity')}</p>
        ) : total === 0 ? (
          <p className="text-small text-muted-foreground">{t('empty')}</p>
        ) : (
          <div className="grid min-w-0 gap-4">
            <p className="text-small text-muted-foreground">{t('count', { count: total })}</p>
            <ul className={SCHOOL_LISTING_GRID_CLASS}>
              {rows.map((row) => (
                <li key={row.id} className="h-full min-w-0">
                  <WorkshopCard row={row} />
                </li>
              ))}
            </ul>
            {pages > 1 ? (
              <nav
                className="flex min-w-0 flex-wrap items-center gap-2"
                aria-label={t('pageLabel', { page })}
              >
                {page > 1 ? (
                  <Link
                    href={hrefFor({ page: page - 1 })}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground"
                  >
                    {t('previous')}
                  </Link>
                ) : null}
                <p className="text-small text-muted-foreground">{t('pageLabel', { page })}</p>
                {page < pages ? (
                  <Link
                    href={hrefFor({ page: page + 1 })}
                    className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-sm text-foreground"
                  >
                    {t('next')}
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

function WorkshopCard({ row }: { row: Workshop }) {
  return (
    <a
      href={row.website || row.sourceUrl}
      target="_blank"
      rel="noreferrer"
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <WorkshopBody row={row} />
    </a>
  );
}

async function WorkshopBody({ row }: { row: Workshop }) {
  const t = await getTranslations('workshopPage');
  const address = row.street || row.postcode ? workshopAddress(row) : '';
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
      <span className="dlu-school-photo dlu-school-photo--compact">
        <span className="flex h-full items-center justify-center font-display text-lg font-normal text-foreground">
          {row.name.slice(0, 1)}
        </span>
      </span>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] leading-snug text-muted-foreground sm:text-small">
            {row.city || t('cityUnknown')}
          </p>
          <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
            {row.name}
          </h3>
        </div>
        <p className="text-small text-foreground">{address || t('addressMissing')}</p>
      </div>
    </article>
  );
}
