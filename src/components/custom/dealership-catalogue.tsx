import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { CatalogueOutboundLink } from '@/components/custom/catalogue-outbound-link';
import { Button } from '@/components/ui/button';
import { dealerListingHref } from '@/lib/contact/claim-listing';
import { orderCatalogue } from '@/lib/discovery/catalogue-rank-store';
import {
  type DealershipVehicle,
  type DealershipVehicleKind,
  dealerCountries,
  dealersForCars,
  listDealerships,
  type PublishedCar,
  searchPublishedCars,
} from '@/lib/discovery/dealerships';
import { intlLocale } from '@/lib/intl-locale';
import { localePath } from '@/lib/seo/locale-path';

const KINDS: DealershipVehicleKind[] = ['car', 'van', 'heavy', 'motorcycle', 'other'];
const CONDITIONS = ['new', 'used'] as const;

function formatMoney(amount: number, currency: string, locale: string) {
  return `${new Intl.NumberFormat(intlLocale(locale)).format(amount)} ${currency}`;
}

function priceCaption(
  kind: DealershipVehicle['priceKind'],
  label: (key: 'msrp' | 'from') => string,
) {
  if (kind === 'msrp') return label('msrp');
  if (kind === 'from') return label('from');
  return null;
}

function specLine(
  vehicle: DealershipVehicle,
  mileageMil: (value: string) => string,
  mileageKm: (value: string) => string,
) {
  const mileage =
    vehicle.mileage == null || !vehicle.mileageUnit
      ? null
      : vehicle.mileageUnit === 'mil'
        ? mileageMil(new Intl.NumberFormat('sv-SE').format(vehicle.mileage))
        : mileageKm(new Intl.NumberFormat('sv-SE').format(vehicle.mileage));
  return [vehicle.year, mileage, vehicle.fuel, vehicle.gearbox, vehicle.power, vehicle.color]
    .filter(Boolean)
    .join(' · ');
}

export async function DealershipCatalogue({
  city,
  kind,
  country,
  q,
  condition,
}: {
  city?: string;
  kind?: string;
  country?: string;
  q?: string;
  condition?: string;
}) {
  const t = await getTranslations('dealershipsPage');
  const locale = await getLocale();
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  const countries = dealerCountries();
  const selectedCountry = countries.find((code) => code === country?.toUpperCase()) ?? null;
  const selectedKind = KINDS.find((value) => value === kind) ?? null;
  const selectedCondition = CONDITIONS.find((value) => value === condition) ?? null;
  const model = q?.trim() ?? '';
  const place = city?.trim() ?? '';
  const businesses = listDealerships().filter((dealer) =>
    selectedCountry ? dealer.country === selectedCountry : false,
  );
  const cars = searchPublishedCars({
    q: model,
    city: place,
    country: selectedCountry ?? undefined,
    kind: selectedKind ?? undefined,
    condition: selectedCondition ?? undefined,
  });
  const cities = [...new Set(cars.map((car) => car.dealerCity).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, locale),
  );
  const ranked = await orderCatalogue('car', cars, (car) => ({
    id: car.id,
    currency: car.vehicle.currency,
    amount: car.vehicle.price,
    country: car.dealerCountry,
    checkedAt: null,
  }));
  const rows = ranked.slice(0, model || place ? 120 : 60);
  const dealerGroups = model ? dealersForCars(rows) : [];
  const listedBusinesses = businesses
    .filter((dealer) =>
      place ? dealer.city.toLocaleLowerCase().includes(place.toLocaleLowerCase()) : true,
    )
    .sort((a, b) => a.city.localeCompare(b.city, 'sv') || a.name.localeCompare(b.name, 'sv'))
    .slice(0, 240);

  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight">{t('title')}</h1>
        <p className="text-body-lg text-muted-foreground">{t('lead')}</p>
        <Button asChild variant="outline" className="w-fit">
          <Link href={localePath(locale, dealerListingHref())}>{t('listCta')}</Link>
        </Button>
      </header>

      <form
        className="mx-auto mt-8 flex max-w-3xl flex-wrap gap-3"
        action={localePath(locale, '/bilhandlare')}
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('modelLabel')}
          <input
            name="q"
            defaultValue={model}
            placeholder={t('modelPlaceholder')}
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
          />
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('cityLabel')}
          <input
            name="city"
            defaultValue={place}
            placeholder={t('placePlaceholder')}
            list="dealer-cities"
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
          />
          <datalist id="dealer-cities">
            {cities.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('countryLabel')}
          <select
            name="country"
            defaultValue={selectedCountry ?? ''}
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="">{t('countryAll')}</option>
            {countries.map((code) => (
              <option key={code} value={code}>
                {regionNames.of(code) ?? code}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('conditionLabel')}
          <select
            name="condition"
            defaultValue={selectedCondition ?? ''}
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="">{t('conditionAny')}</option>
            {CONDITIONS.map((value) => (
              <option key={value} value={value}>
                {t(`condition.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-small text-muted-foreground">
          {t('kindLabel')}
          <select
            name="kind"
            defaultValue={selectedKind ?? ''}
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
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
          className="self-end rounded-full bg-foreground px-4 py-2 text-small text-background"
        >
          {t('filter')}
        </button>
      </form>

      <p className="mx-auto mt-6 max-w-3xl text-small text-muted-foreground">{t('sourceNote')}</p>

      {rows.length === 0 ? (
        <p className="mx-auto mt-10 max-w-3xl text-body text-muted-foreground">{t('empty')}</p>
      ) : dealerGroups.length > 0 ? (
        <div className="mx-auto mt-8 grid max-w-6xl gap-10">
          {dealerGroups.map((group) => (
            <section key={group.id}>
              <h2 className="font-display text-h3 font-normal tracking-tight">{group.name}</h2>
              <p className="mt-1 text-small text-muted-foreground">
                {[group.city, regionNames.of(group.country) ?? group.country]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.cars.map((car) => (
                  <CarCard
                    key={car.id}
                    car={car}
                    specs={specLine(
                      car.vehicle,
                      (value) => t('mileageMil', { value }),
                      (value) => t('mileageKm', { value }),
                    )}
                    price={formatMoney(car.vehicle.price, car.vehicle.currency, locale)}
                    priceCaption={priceCaption(car.vehicle.priceKind, t)}
                    conditionLabel={
                      car.vehicle.condition ? t(`condition.${car.vehicle.condition}`) : null
                    }
                    claimHref={localePath(locale, dealerListingHref({ name: car.dealerName }))}
                    claimLabel={t('claim')}
                    claimAria={t('claimAria', { name: car.dealerName })}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <ul className="mx-auto mt-8 grid max-w-6xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              specs={specLine(
                car.vehicle,
                (value) => t('mileageMil', { value }),
                (value) => t('mileageKm', { value }),
              )}
              price={formatMoney(car.vehicle.price, car.vehicle.currency, locale)}
              priceCaption={priceCaption(car.vehicle.priceKind, t)}
              conditionLabel={
                car.vehicle.condition ? t(`condition.${car.vehicle.condition}`) : null
              }
              claimHref={localePath(locale, dealerListingHref({ name: car.dealerName }))}
              claimLabel={t('claim')}
              claimAria={t('claimAria', { name: car.dealerName })}
            />
          ))}
        </ul>
      )}

      {model ? null : listedBusinesses.length > 0 ? (
        <section className="mx-auto mt-16 max-w-5xl">
          <h2 className="font-display text-h2 font-normal tracking-tight">
            {t('businessesTitle')}
          </h2>
          <p className="mt-2 max-w-3xl text-body text-muted-foreground">{t('businessesLead')}</p>
          <ul className="mt-6 grid gap-3">
            {listedBusinesses.map((dealer) => (
              <li
                key={dealer.id}
                className="flex min-w-0 items-center justify-between gap-4 rounded-[1.25rem] border border-border bg-card p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-small text-muted-foreground">{dealer.city}</p>
                  <h3 className="truncate font-display text-h4 font-normal tracking-tight">
                    {dealer.name}
                  </h3>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      href={localePath(locale, dealerListingHref({ name: dealer.name }))}
                      aria-label={t('claimAria', { name: dealer.name })}
                    >
                      {t('claim')}
                    </Link>
                  </Button>
                  {dealer.website ? (
                    <a
                      href={dealer.website}
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-full border border-border px-3 py-2 text-small"
                    >
                      {t('openSite')}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

function CarCard({
  car,
  specs,
  price,
  priceCaption,
  conditionLabel,
  claimHref,
  claimLabel,
  claimAria,
}: {
  car: PublishedCar;
  specs: string;
  price: string;
  priceCaption: string | null;
  conditionLabel: string | null;
  claimHref: string;
  claimLabel: string;
  claimAria: string;
}) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_1px_2px_rgba(19,19,18,.04),0_8px_24px_-12px_rgba(19,19,18,.12)]">
      <CatalogueOutboundLink
        catalogue="car"
        itemId={car.id}
        href={car.vehicle.sourceUrl}
        className="flex flex-1 flex-col"
        newTab={false}
      >
        <div className="aspect-[16/10] bg-muted">
          {car.vehicle.imageUrl ? (
            // biome-ignore lint/performance/noImgElement: the photo is hosted on the dealer's own image host
            <img
              src={car.vehicle.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : null}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="font-display text-h4 font-normal tracking-tight">{car.vehicle.name}</h3>
          {conditionLabel ? (
            <p className="text-small text-muted-foreground">{conditionLabel}</p>
          ) : null}
          <p className="text-small text-muted-foreground">{specs}</p>
          {priceCaption ? (
            <p className="mt-auto text-small text-muted-foreground">{priceCaption}</p>
          ) : null}
          <p
            className={`${priceCaption ? '' : 'mt-auto '}font-display text-h3 font-normal tracking-tight`}
          >
            {price}
          </p>
          <p className="truncate text-small text-muted-foreground">
            {car.dealerName}
            {car.dealerCity ? ` · ${car.dealerCity}` : ''}
          </p>
        </div>
      </CatalogueOutboundLink>
      <div className="px-4 pb-4">
        <Button asChild variant="outline" size="sm">
          <Link href={claimHref} aria-label={claimAria}>
            {claimLabel}
          </Link>
        </Button>
      </div>
    </li>
  );
}
