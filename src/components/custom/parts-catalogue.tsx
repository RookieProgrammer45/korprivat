import { getLocale, getTranslations } from 'next-intl/server';
import { PartsBrowser } from '@/components/custom/parts-browser';
import { type PartKind, partSellerCountries, searchParts } from '@/lib/discovery/parts';
import { localePath } from '@/lib/seo/locale-path';
import { PART_PLACES } from '@/lib/seo/parts-search-path';

const KINDS: PartKind[] = ['part', 'motorcycle', 'accessory'];

function coordinate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const BUYERS = ['owner', 'workshop'] as const;
const COUNTRY_CODES = ['AU', 'FI', 'SE', 'US'] as const;

export async function PartsCatalogue({
  q,
  kind,
  place,
  lat,
  lng,
  buyer,
  country,
}: {
  q?: string;
  kind?: string;
  place?: string;
  lat?: string;
  lng?: string;
  buyer?: string;
  country?: string;
}) {
  const t = await getTranslations('partsPage');
  const countryNames = await getTranslations('partsPage.countries');
  const cities = await getTranslations('publicHome.hero.search.cities');
  const locale = await getLocale();
  const query = q?.trim() ?? '';
  const selectedKind = KINDS.find((value) => value === kind) ?? null;
  const near = place?.trim() ?? '';
  const latitude = coordinate(lat);
  const longitude = coordinate(lng);
  const selectedBuyer = BUYERS.find((value) => value === buyer) ?? null;
  const selectedCountry =
    partSellerCountries().find((value) => value === country?.trim().toUpperCase()) ?? null;
  const products = searchParts({
    q: query,
    kind: selectedKind ?? undefined,
    place: near,
    lat: latitude,
    lng: longitude,
    buyer: selectedBuyer ?? undefined,
    country: selectedCountry ?? undefined,
  }).slice(0, 60);

  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight">{t('title')}</h1>
        <p className="max-w-xl text-body-lg text-muted-foreground">{t('lead')}</p>
      </header>

      <form
        className="mx-auto mt-8 flex max-w-3xl flex-wrap items-end gap-3"
        action={localePath(locale, '/reservdelar')}
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('queryLabel')}
          <input
            name="q"
            defaultValue={query}
            placeholder={t('queryPlaceholder')}
            className="min-h-11 rounded-full border border-border bg-card px-3 text-foreground"
          />
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-small text-muted-foreground">
          {t('placeLabel')}
          <select
            name="place"
            defaultValue={near}
            className="min-h-11 rounded-full border border-border bg-card px-3 text-foreground"
          >
            <option value="">{t('cityAny')}</option>
            {PART_PLACES.map((city) => (
              <option key={city.id} value={city.value}>
                {cities(city.id)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-small text-muted-foreground">
          {t('buyerLabel')}
          <select
            name="buyer"
            defaultValue={selectedBuyer ?? ''}
            className="min-h-11 rounded-full border border-border bg-card px-3 text-foreground"
          >
            <option value="">{t('buyerAll')}</option>
            {BUYERS.map((value) => (
              <option key={value} value={value}>
                {t(`buyer.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-small text-muted-foreground">
          {t('countryLabel')}
          <select
            name="country"
            defaultValue={selectedCountry ?? ''}
            className="min-h-11 rounded-full border border-border bg-card px-3 text-foreground"
          >
            <option value="">{t('countryAny')}</option>
            {COUNTRY_CODES.filter((code) => partSellerCountries().includes(code)).map((code) => (
              <option key={code} value={code}>
                {countryNames(code)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-col gap-1 text-small text-muted-foreground">
          {t('kindLabel')}
          <select
            name="kind"
            defaultValue={selectedKind ?? ''}
            className="min-h-11 rounded-full border border-border bg-card px-3 text-foreground"
          >
            <option value="">{t('kindAll')}</option>
            {KINDS.map((value) => (
              <option key={value} value={value}>
                {t(`kind.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center rounded-full border border-foreground bg-foreground px-4 text-small text-background"
        >
          {t('filter')}
        </button>
      </form>

      <p className="mx-auto mt-4 max-w-3xl text-small text-muted-foreground">{t('sourceNote')}</p>

      <PartsBrowser
        products={products}
        place={near}
        located={Boolean(near || (latitude != null && longitude != null))}
      />
    </main>
  );
}
