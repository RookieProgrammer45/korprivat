'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { rememberCatalogueOpen } from '@/components/custom/catalogue-outbound-link';
import { useUserLocation } from '@/hooks/use-user-location';
import type { PartMatch } from '@/lib/discovery/parts';
import { intlLocale } from '@/lib/intl-locale';

const COMPARE_LIMIT = 3;

function formatMoney(amount: number, currency: string, locale: string) {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  return `${formatted} ${currency}`;
}

function formatKm(km: number) {
  return km >= 10 ? String(Math.round(km)) : km.toFixed(1);
}

export function PartsBrowser({
  products,
  place,
  located,
}: {
  products: PartMatch[];
  place: string;
  located: boolean;
}) {
  const t = useTranslations('partsPage');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const location = useUserLocation();
  const [picked, setPicked] = useState<string[]>([]);
  const [limitReached, setLimitReached] = useState(false);

  useEffect(() => {
    if (location.status !== 'granted' || !location.coords) return;
    const params = new URLSearchParams(searchParams.toString());
    const lat = location.coords.latitude.toFixed(5);
    const lng = location.coords.longitude.toFixed(5);
    if (params.get('lat') === lat && params.get('lng') === lng && !params.get('place')) return;
    params.delete('place');
    params.set('lat', lat);
    params.set('lng', lng);
    router.push(`${pathname}?${params.toString()}`);
  }, [location.coords, location.status, pathname, router, searchParams]);

  function clearLocation() {
    location.reset();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('lat');
    params.delete('lng');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function toggle(id: string) {
    setLimitReached(false);
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= COMPARE_LIMIT) {
        setLimitReached(true);
        return current;
      }
      return [...current, id];
    });
  }

  const nearby = products.filter((product) => product.nearestStore);
  const rest = products.filter((product) => !product.nearestStore);
  const compared = picked
    .map((id) => products.find((product) => product.id === id))
    .filter((product): product is PartMatch => Boolean(product));
  const statusKey =
    location.status === 'idle'
      ? located
        ? nearby.length > 0
          ? 'locationGranted'
          : 'locationNone'
        : 'locationPrompt'
      : location.status === 'requesting'
        ? 'locationRequesting'
        : location.status === 'granted'
          ? nearby.length > 0
            ? 'locationGranted'
            : 'locationNone'
          : location.status === 'denied'
            ? 'locationDenied'
            : location.status === 'unsupported'
              ? 'locationUnsupported'
              : 'locationFailed';

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-3 rounded-[1.25rem] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-small text-muted-foreground">{t(statusKey)}</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={location.request}
            disabled={location.status === 'requesting'}
            className="inline-flex min-h-11 items-center rounded-full border border-border bg-card px-4 text-small text-foreground"
          >
            {t('useMyLocation')}
          </button>
          {searchParams.get('lat') && searchParams.get('lng') ? (
            <button
              type="button"
              onClick={clearLocation}
              className="inline-flex min-h-11 items-center rounded-full px-4 text-small text-muted-foreground"
            >
              {t('clearLocation')}
            </button>
          ) : null}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="mt-10 text-body text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          {nearby.length > 0 ? (
            <section className="mt-8">
              <h2 className="font-display text-h2 tracking-tight">{t('nearest')}</h2>
              <ul className="mt-2 divide-y divide-border border-y border-border">
                {nearby.map((product) => (
                  <PartRow
                    key={product.id}
                    product={product}
                    locale={locale}
                    place={place}
                    picked={picked.includes(product.id)}
                    onToggle={() => toggle(product.id)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <PriceGroups
            products={rest.length > 0 ? rest : nearby.length > 0 ? [] : products}
            locale={locale}
            picked={picked}
            onToggle={toggle}
          />

          {limitReached ? (
            <p className="mt-4 text-small text-muted-foreground">
              {t('compareLimit', { count: COMPARE_LIMIT })}
            </p>
          ) : (
            <p className="mt-4 text-small text-muted-foreground">
              {t('comparePick', { count: COMPARE_LIMIT })}
            </p>
          )}

          {compared.length > 1 ? (
            <section className="mt-8">
              <h2 className="font-display text-h2 tracking-tight">{t('compareTitle')}</h2>
              <p className="mt-2 max-w-xl text-body text-muted-foreground">{t('compareLead')}</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[40rem] border-collapse text-left text-small">
                  <caption className="sr-only">{t('compareTitle')}</caption>
                  <thead>
                    <tr className="border-b border-border">
                      {compared.map((product) => (
                        <th
                          key={product.id}
                          scope="col"
                          className="px-3 py-3 align-bottom font-normal"
                        >
                          <span className="block font-display text-lg leading-snug tracking-tight text-foreground">
                            {product.name}
                          </span>
                          <span className="mt-1 block text-foreground">
                            {formatMoney(product.price, product.currency, locale)}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="align-top">
                      {compared.map((product) => (
                        <td key={product.id} className="px-3 py-3 text-muted-foreground">
                          <ul className="flex flex-col gap-1">
                            {product.specs.map((spec, index) => (
                              <li key={`${product.id}-${index}`}>{spec}</li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function PriceGroups({
  products,
  locale,
  picked,
  onToggle,
}: {
  products: PartMatch[];
  locale: string;
  picked: string[];
  onToggle: (id: string) => void;
}) {
  const t = useTranslations('partsPage');
  if (products.length === 0) return null;
  const currencies: string[] = [];
  for (const product of products) {
    if (!currencies.includes(product.currency)) currencies.push(product.currency);
  }
  return (
    <div className="mt-8 flex flex-col gap-8">
      {currencies.map((currency) => (
        <section key={currency}>
          <h2 className="font-display text-h2 tracking-tight">
            {t('currencyGroup', { currency })}
          </h2>
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {products
              .filter((product) => product.currency === currency)
              .map((product) => (
                <PartRow
                  key={product.id}
                  product={product}
                  locale={locale}
                  place=""
                  picked={picked.includes(product.id)}
                  onToggle={() => onToggle(product.id)}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PartRow({
  product,
  locale,
  place,
  picked,
  onToggle,
}: {
  product: PartMatch;
  locale: string;
  place: string;
  picked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('partsPage');
  const store = product.nearestStore;
  const where = store
    ? [store.name, store.address, store.city, store.region].filter(Boolean).join(', ')
    : null;
  return (
    <li className="grid gap-4 py-5 sm:grid-cols-[auto_5rem_minmax(0,1fr)_auto] sm:items-start">
      <label className="flex min-h-11 items-center gap-2 text-small text-muted-foreground">
        <input
          type="checkbox"
          checked={picked}
          onChange={onToggle}
          className="size-4 accent-foreground"
        />
        <span className="sr-only">{product.name}</span>
      </label>
      {product.imageUrl ? (
        // biome-ignore lint/performance/noImgElement: the photo is hosted by the seller
        <img
          src={product.imageUrl}
          alt=""
          referrerPolicy="no-referrer"
          className="h-20 w-20 rounded-xl border border-border bg-card object-contain p-1"
        />
      ) : (
        <div className="h-20 w-20 rounded-xl bg-muted" />
      )}
      <div className="min-w-0">
        <p className="text-small text-muted-foreground">
          {[product.brand, product.sellerName].filter(Boolean).join(' · ')}
        </p>
        <h3 className="mt-1 font-display text-lg leading-snug tracking-tight text-foreground">
          {product.name}
        </h3>
        <ul className="mt-2 flex flex-col gap-1 text-small text-muted-foreground">
          {product.specs.slice(0, 4).map((spec, index) => (
            <li key={`${product.id}-${index}`}>{spec}</li>
          ))}
        </ul>
        {where ? (
          <p className="mt-2 text-small text-foreground">
            {where}
            {product.nearestKm != null
              ? ` · ${
                  place
                    ? t('kmAway', { km: formatKm(product.nearestKm), place })
                    : t('kmFromYou', { km: formatKm(product.nearestKm) })
                }`
              : ''}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <p className="font-display text-2xl tracking-tight text-foreground">
          {formatMoney(product.price, product.currency, locale)}
        </p>
        <a
          href={product.sourceUrl}
          onClick={() => rememberCatalogueOpen('part', product.id)}
          className="inline-flex min-h-11 items-center text-small text-foreground underline underline-offset-4"
        >
          {t('openSite', { seller: product.sellerName })}
        </a>
      </div>
    </li>
  );
}
