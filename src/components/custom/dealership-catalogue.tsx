import { getLocale, getTranslations } from 'next-intl/server';
import { BusinessLogo } from '@/components/custom/business-logo';
import {
  compareDealerships,
  type Dealership,
  type DealershipVehicleKind,
  dealerCities,
  listDealerships,
} from '@/lib/discovery/dealerships';
import { localePath } from '@/lib/seo/locale-path';

const KINDS: DealershipVehicleKind[] = ['car', 'van', 'heavy', 'other'];

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('sv-SE').format(amount)} ${currency}`;
}

export async function DealershipCatalogue({ city, kind }: { city?: string; kind?: string }) {
  const t = await getTranslations('dealershipsPage');
  const locale = await getLocale();
  const selectedKind = KINDS.find((value) => value === kind) ?? null;
  const all = listDealerships();
  const cities = dealerCities();
  const selectedCity = city && cities.includes(city) ? city : null;
  const rows = all
    .filter((dealer) => (selectedCity ? dealer.city === selectedCity : true))
    .filter((dealer) =>
      selectedKind ? dealer.vehicles.some((vehicle) => vehicle.kind === selectedKind) : true,
    )
    .sort(compareDealerships);

  return (
    <main className="container-page section">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t('eyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight">{t('title')}</h1>
        <p className="text-body-lg text-muted-foreground">{t('lead')}</p>
      </header>

      <form
        className="mx-auto mt-8 flex max-w-3xl flex-wrap gap-3"
        action={localePath(locale, '/bilhandlare')}
      >
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
        <ul className="mx-auto mt-8 grid max-w-5xl gap-3">
          {rows.slice(0, 240).map((dealer) => (
            <DealerRow
              key={dealer.id}
              dealer={dealer}
              kind={selectedKind}
              offerLabel={(name, price) => t('offer', { name, price })}
              noPrice={t('noPrice')}
              openSite={t('openSite')}
            />
          ))}
        </ul>
      )}
    </main>
  );
}

function DealerRow({
  dealer,
  kind,
  offerLabel,
  noPrice,
  openSite,
}: {
  dealer: Dealership;
  kind: DealershipVehicleKind | null;
  offerLabel: (name: string, price: string) => string;
  noPrice: string;
  openSite: string;
}) {
  const vehicles = kind
    ? dealer.vehicles.filter((vehicle) => vehicle.kind === kind)
    : dealer.vehicles;
  const offer = vehicles.reduce<(typeof vehicles)[number] | null>((best, vehicle) => {
    if (!best || vehicle.price < best.price) return vehicle;
    return best;
  }, null);

  return (
    <li className="flex min-w-0 items-center gap-4 rounded-[1.25rem] border border-border bg-card p-4">
      <BusinessLogo
        src={dealer.logoUrl}
        fallback={dealer.name}
        className="size-12 shrink-0 rounded-full border border-border"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-small text-muted-foreground">
          {dealer.city}
          {dealer.brands.length > 0 ? ` · ${dealer.brands.slice(0, 3).join(', ')}` : ''}
        </p>
        <h2 className="truncate font-display text-h4 font-normal tracking-tight">{dealer.name}</h2>
        <p className="truncate text-small text-muted-foreground">
          {offer ? offerLabel(offer.name, formatMoney(offer.price, offer.currency)) : noPrice}
          {dealer.sourceName ? ` · ${dealer.sourceName}` : ''}
        </p>
      </div>
      {dealer.website ? (
        <a
          href={dealer.website}
          className="shrink-0 rounded-full border border-border px-3 py-2 text-small"
          rel="noopener noreferrer"
        >
          {openSite}
        </a>
      ) : null}
    </li>
  );
}
