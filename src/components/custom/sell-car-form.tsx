'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { LocaleLink } from '@/components/locale-link';
import { Button } from '@/components/ui/button';
import { estimateOwnedVehicle, publishOwnedVehicle } from '@/lib/vehicle-sales/actions';
import { SALE_CURRENCIES } from '@/lib/vehicle-sales/schema';

type Estimate = {
  currency: string;
  amount: number | null;
  low: number | null;
  high: number | null;
  count: number;
  buyers: { dealerId: string; name: string; city: string; sourceUrl: string }[];
};

const fieldClass = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm';

function money(locale: string, currency: string, amount: number): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount)} ${currency}`;
}

export function SellCarForm({ countries }: { countries: string[] }) {
  const t = useTranslations('sellCarPage');
  const locale = useLocale();
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [country, setCountry] = useState(countries.includes('SE') ? 'SE' : (countries[0] ?? 'SE'));
  const [currency, setCurrency] = useState<(typeof SALE_CURRENCIES)[number]>('SEK');
  const [city, setCity] = useState('');
  const [asking, setAsking] = useState('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState<'estimate' | 'publish' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [listingId, setListingId] = useState<string | null>(null);

  function payload() {
    const askingAmount = asking.trim() === '' ? null : Number(asking);
    return {
      make,
      model,
      year: year === '' ? null : Number(year),
      country,
      currency,
      city,
      askingAmount: Number.isInteger(askingAmount) ? askingAmount : null,
      note: note.trim() === '' ? null : note.trim(),
    };
  }

  function clearResult() {
    setEstimate(null);
    setListingId(null);
    setError(null);
  }

  async function onEstimate() {
    setPending('estimate');
    setError(null);
    setListingId(null);
    try {
      const result = await estimateOwnedVehicle(payload());
      setPending(null);
      if (!result.ok) {
        setEstimate(null);
        setError(t(`errors.${result.error}`));
        return;
      }
      setEstimate(result.estimate);
    } catch {
      setPending(null);
      setEstimate(null);
      setError(t('errors.invalid'));
    }
  }

  async function onPublish() {
    setPending('publish');
    setError(null);
    try {
      const result = await publishOwnedVehicle(payload());
      setPending(null);
      if (!result.ok) {
        setError(t(`errors.${result.error}`));
        return;
      }
      setEstimate(result.estimate);
      setListingId(result.listingId ?? null);
    } catch {
      setPending(null);
      setError(t('errors.invalid'));
    }
  }

  const years = Array.from({ length: 2027 - 1980 + 1 }, (_, index) => 2027 - index);

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void onEstimate();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span>{t('form.make')}</span>
          <input
            className={fieldClass}
            value={make}
            maxLength={40}
            required
            onChange={(event) => {
              setMake(event.target.value);
              clearResult();
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.model')}</span>
          <input
            className={fieldClass}
            value={model}
            maxLength={40}
            required
            onChange={(event) => {
              setModel(event.target.value);
              clearResult();
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.year')}</span>
          <select
            className={fieldClass}
            value={year}
            onChange={(event) => {
              setYear(event.target.value);
              clearResult();
            }}
          >
            <option value="">{t('form.yearNone')}</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.country')}</span>
          <select
            className={fieldClass}
            value={country}
            onChange={(event) => {
              setCountry(event.target.value);
              clearResult();
            }}
          >
            {countries.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.currency')}</span>
          <select
            className={fieldClass}
            value={currency}
            onChange={(event) => {
              setCurrency(event.target.value as (typeof SALE_CURRENCIES)[number]);
              clearResult();
            }}
          >
            {SALE_CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.city')}</span>
          <input
            className={fieldClass}
            value={city}
            maxLength={80}
            required
            onChange={(event) => {
              setCity(event.target.value);
              clearResult();
            }}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span>{t('form.asking')}</span>
          <input
            className={fieldClass}
            inputMode="numeric"
            value={asking}
            onChange={(event) => {
              setAsking(event.target.value.replace(/[^\d]/g, ''));
              clearResult();
            }}
          />
        </label>
      </div>
      <label className="block space-y-1 text-sm">
        <span>{t('form.note')}</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          maxLength={500}
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            clearResult();
          }}
        />
        <span className="block text-muted-foreground">{t('form.noteHint')}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending !== null} className="min-h-11">
          {pending === 'estimate' ? t('form.working') : t('form.estimate')}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || estimate === null}
          className="min-h-11"
          onClick={() => void onPublish()}
        >
          {pending === 'publish' ? t('form.working') : t('form.publish')}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {estimate ? (
        <div className="space-y-3 rounded-2xl border border-border p-4">
          {estimate.amount != null && estimate.low != null && estimate.high != null ? (
            <>
              <p className="text-sm text-muted-foreground">{t('result.median')}</p>
              <p className="font-display text-4xl tracking-tight">
                {money(locale, estimate.currency, estimate.amount)}
              </p>
              <p className="text-sm text-muted-foreground">
                {t('result.range', {
                  low: money(locale, estimate.currency, estimate.low),
                  high: money(locale, estimate.currency, estimate.high),
                })}
              </p>
              <p className="text-sm">{t('result.count', { count: estimate.count })}</p>
            </>
          ) : (
            <p className="text-sm">{t('result.none')}</p>
          )}
          {estimate.buyers.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm">{t('result.buyers')}</p>
              <ul className="space-y-2">
                {estimate.buyers.map((buyer) => (
                  <li key={buyer.dealerId}>
                    <a
                      className="text-sm underline-offset-4 hover:underline"
                      href={buyer.sourceUrl}
                    >
                      {buyer.name}
                      {buyer.city ? ` · ${buyer.city}` : ''}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('result.buyersNone')}</p>
          )}
          {listingId ? (
            <p className="text-sm">
              {t('result.published')}{' '}
              <LocaleLink
                className="underline-offset-4 hover:underline"
                href={`/bilar-till-salu/${listingId}`}
              >
                {t('result.open')}
              </LocaleLink>
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
