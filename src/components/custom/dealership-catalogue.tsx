import Link from 'next/link';
import { getLocale, getTranslations } from 'next-intl/server';
import { Button } from '@/components/ui/button';
import { dealerListingHref } from '@/lib/contact/claim-listing';
import {
  type DealershipVehicle,
  type DealershipVehicleKind,
  dealerCountries,
  listDealerships,
  type PublishedCar,
  publishedCars,
} from '@/lib/discovery/dealerships';
import { localePath } from '@/lib/seo/locale-path';

const KINDS: DealershipVehicleKind[] = ['car', 'van', 'heavy', 'other'];

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('sv-SE').format(amount)} ${currency}`;
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
  return [vehicle.year, mileage, vehicle.fuel, vehicle.gearbox].filter(Boolean).join(' · ');
}

export async function DealershipCatalogue({
  city,
  kind,
  country,
}: {
  city?: string;
  kind?: string;
  country?: string;
}) {
  const t = await getTranslations('dealershipsPage');
  const locale = await getLocale();
  const regionNames = new Intl.DisplayNames([locale], { type: 'region' });
  const countries = dealerCountries();
  const selectedCountry = countries.find((code) => code === country?.toUpperCase()) ?? null;
  const selectedKind = KINDS.find((value) => value === kind) ?? null;
  const businesses = listDealerships().filter((dealer) =>
    selectedCountry ? dealer.country === selectedCountry : false,
  );
  const cars = publishedCars().filter(
    (car) =>
      (selectedCountry ? car.dealerCountry === selectedCountry : true) &&
      (selectedKind ? car.vehicle.kind === selectedKind : true),
  );
  const cities = [
    ...new Set(
      (selectedCountry
        ? businesses.map((dealer) => dealer.city)
        : cars.map((car) => car.dealerCity)
      ).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'sv'));
  const selectedCity = city && cities.includes(city) ? city : null;
  const rows = cars
    .filter((car) => (selectedCity ? car.dealerCity === selectedCity : true))
    .slice(0, 60);
  const listedBusinesses = businesses
    .filter((dealer) => (selectedCity ? dealer.city === selectedCity : true))
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
          {t('cityLabel')}
          <select
            name="city"
            defaultValue={selectedCity ?? ''}
            className="rounded-full border border-border bg-card px-3 py-2 text-foreground"
          >
            <option value="">{t('cityAll')}</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
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
              price={formatMoney(car.vehicle.price, car.vehicle.currency)}
              claimHref={localePath(locale, dealerListingHref({ name: car.dealerName }))}
              claimLabel={t('claim')}
              claimAria={t('claimAria', { name: car.dealerName })}
            />
          ))}
        </ul>
      )}

      {listedBusinesses.length > 0 ? (
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
  claimHref,
  claimLabel,
  claimAria,
}: {
  car: PublishedCar;
  specs: string;
  price: string;
  claimHref: string;
  claimLabel: string;
  claimAria: string;
}) {
  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] border border-border bg-card shadow-[0_1px_2px_rgba(19,19,18,.04),0_8px_24px_-12px_rgba(19,19,18,.12)]">
      <a href={car.vehicle.sourceUrl} rel="noopener noreferrer" className="flex flex-1 flex-col">
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
          <h2 className="font-display text-h4 font-normal tracking-tight">{car.vehicle.name}</h2>
          <p className="text-small text-muted-foreground">{specs}</p>
          <p className="mt-auto font-display text-h3 font-normal tracking-tight">{price}</p>
          <p className="truncate text-small text-muted-foreground">
            {car.dealerName}
            {car.dealerCity ? ` · ${car.dealerCity}` : ''}
          </p>
        </div>
      </a>
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
