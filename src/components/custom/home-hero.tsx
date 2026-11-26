// Search-first entry. The title alternates between driving schools and dealers.
// The photograph stays on desktop, with the two comparison paths on top of it.

'use client';

import { ChevronDown, Search, Truck } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { RotatingTitle } from '@/components/custom/animated-title';
import { LocaleLink as Link } from '@/components/locale-link';
import { dealerSearchPath } from '@/lib/seo/dealer-search-path';
import { localePath } from '@/lib/seo/locale-path';
import { SEARCH_CITIES, schoolSearchPath } from '@/lib/seo/school-search-path';

const SEARCH_CATEGORIES = ['B', 'A', 'BE'] as const;

const POPULAR_LINKS = [
  { key: 'dealers', href: '/bilhandlare' },
  { key: 'heavy', href: '/tung-trafik' },
  { key: 'categoryA', href: '/?category=A' },
  { key: 'stockholm', href: '/locations/se/stockholm' },
  { key: 'goteborg', href: '/locations/se/goteborg' },
  { key: 'malmo', href: '/locations/se/malmo' },
  { key: 'oslo', href: '/locations/no/oslo' },
] as const;

export function HomeHero({
  dealerCities,
  lessonFrom,
  vehicleFrom,
}: {
  dealerCities: readonly string[];
  lessonFrom: number | null;
  vehicleFrom: { amount: number; currency: string } | null;
}) {
  const t = useTranslations('publicHome.hero');
  const tHeavy = useTranslations('heavyVehiclesPage');
  const locale = useLocale();
  const router = useRouter();
  const categoryId = useId();
  const cityId = useId();
  const [mode, setMode] = useState<'school' | 'dealer'>('school');
  const [category, setCategory] = useState<string>('B');
  const [city, setCity] = useState<string>('');
  const [model, setModel] = useState('');
  const dealerMode = mode === 'dealer';

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const path = dealerMode
      ? dealerSearchPath(city, null, model)
      : schoolSearchPath(city, category);
    router.push(localePath(locale, path));
  }

  function selectMode(next: 'school' | 'dealer') {
    setMode(next);
    setCategory(next === 'school' ? 'B' : '');
    setCity('');
    setModel('');
  }

  const money = (amount: number, currency: string) =>
    `${new Intl.NumberFormat(locale).format(amount)} ${currency}`;

  return (
    <section className="marketplace-hero dlu-hero border-b border-border">
      <div className="container-page grid items-start gap-8 pt-4 pb-8 sm:pt-5 lg:grid-cols-[1.05fr_0.95fr] lg:pt-6 lg:pb-10">
        <div className="dlu-hero-copy flex min-w-0 flex-col">
          <RotatingTitle
            lines={[t('titleSchool'), t('titleDealer')]}
            className="marketplace-hero-title max-w-[16ch] font-display text-[2.6rem] leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-6xl xl:text-[4.25rem]"
          />
          <p className="marketplace-reveal dlu-hero-in-2 mt-4 max-w-xl text-body text-muted-foreground">
            {t('body')}
          </p>

          <form
            onSubmit={onSubmit}
            aria-label={t('search.label')}
            className="marketplace-reveal dlu-hero-in-2 dlu-hero-search mt-8 grid w-full max-w-2xl gap-1 rounded-[1.25rem] border border-border bg-card p-2 sm:grid-cols-[auto_1fr_1.15fr_auto] sm:items-center sm:rounded-full sm:p-1.5 sm:pl-2"
          >
            <fieldset className="flex min-w-0 gap-1 border-0 px-1 py-1 sm:px-1">
              <legend className="sr-only">{t('search.modeLabel')}</legend>
              <ModeButton active={!dealerMode} onClick={() => selectMode('school')}>
                {t('search.modeSchool')}
              </ModeButton>
              <ModeButton active={dealerMode} onClick={() => selectMode('dealer')}>
                {t('search.modeDealer')}
              </ModeButton>
            </fieldset>

            {dealerMode ? (
              <SearchText
                id={categoryId}
                label={t('search.modelLabel')}
                value={model}
                onChange={setModel}
                placeholder={t('search.modelPlaceholder')}
                divider
              />
            ) : (
              <SearchField
                id={categoryId}
                label={t('search.categoryLabel')}
                value={category}
                onChange={setCategory}
                divider
              >
                {SEARCH_CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {t(`search.categories.${item}`)}
                  </option>
                ))}
              </SearchField>
            )}

            {dealerMode ? (
              <SearchText
                id={cityId}
                label={t('search.cityLabel')}
                value={city}
                onChange={setCity}
                placeholder={t('search.placePlaceholder')}
                list="hero-dealer-cities"
                divider
              />
            ) : (
              <SearchField
                id={cityId}
                label={t('search.cityLabel')}
                value={city}
                onChange={setCity}
                divider
              >
                <option value="">{t('search.cityAny')}</option>
                {SEARCH_CITIES.map((item) => (
                  <option key={item.id} value={item.value}>
                    {t(`search.cities.${item.id}`)}
                  </option>
                ))}
              </SearchField>
            )}

            <button
              type="submit"
              className="dlu-ink-pill mt-1 cursor-pointer justify-center border-0 sm:mt-0"
            >
              <Search className="size-4" strokeWidth={2} aria-hidden />
              {t('search.submit')}
            </button>
          </form>
          {dealerMode ? (
            <datalist id="hero-dealer-cities">
              {dealerCities.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          ) : null}

          <div className="marketplace-reveal dlu-hero-in-3 mt-5 grid min-w-0 gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
              <span className="mr-1 text-muted-foreground">{t('popular.label')}</span>
              {POPULAR_LINKS.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  aria-describedby={link.key === 'heavy' ? 'hero-heavy-note' : undefined}
                  className="dlu-hero-popular-link inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                >
                  {link.key === 'heavy' ? (
                    <Truck className="size-4" strokeWidth={1.75} aria-hidden />
                  ) : null}
                  {t(`popular.links.${link.key}`)}
                </Link>
              ))}
            </div>
            <p id="hero-heavy-note" className="max-w-xl text-small text-muted-foreground">
              {tHeavy('subtitle')}
            </p>
          </div>
        </div>
        <aside className="marketplace-reveal dlu-hero-in-visual dlu-hero-visual relative hidden min-h-[28rem] overflow-hidden rounded-[1.25rem] border border-border lg:block lg:min-h-[32rem]">
          <Image
            src="/images/hero-lesson.jpg"
            alt={t('imageAlt')}
            fill
            priority
            sizes="(min-width: 1024px) 28rem, 0px"
            className="object-cover"
          />
          <div className="absolute inset-x-5 bottom-5 grid gap-3">
            <Link
              href="/locations/se"
              className="dlu-hero-fact rounded-2xl border border-white/30 bg-white/90 px-4 py-3 text-foreground backdrop-blur-sm"
            >
              <span className="block text-xs text-muted-foreground">{t('facts.lesson')}</span>
              <span className="mt-1 block font-display text-xl tracking-tight">
                {lessonFrom
                  ? t('facts.from', { price: money(lessonFrom, 'SEK') })
                  : t('facts.lessonFallback')}
              </span>
            </Link>
            <Link
              href="/bilhandlare"
              className="dlu-hero-fact dlu-hero-fact-late rounded-2xl border border-white/30 bg-white/90 px-4 py-3 text-foreground backdrop-blur-sm"
            >
              <span className="block text-xs text-muted-foreground">{t('facts.vehicle')}</span>
              <span className="mt-1 block font-display text-xl tracking-tight">
                {vehicleFrom
                  ? t('facts.from', { price: money(vehicleFrom.amount, vehicleFrom.currency) })
                  : t('facts.vehicleFallback')}
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm ${
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}

function SearchText({
  id,
  label,
  value,
  onChange,
  placeholder,
  list,
  divider = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  list?: string;
  divider?: boolean;
}) {
  return (
    <div
      className={`relative min-w-0 rounded-2xl px-4 py-2 transition-colors focus-within:bg-muted hover:bg-muted sm:rounded-full sm:px-5 ${
        divider
          ? 'sm:before:absolute sm:before:left-0 sm:before:top-1/2 sm:before:h-7 sm:before:w-px sm:before:-translate-y-1/2 sm:before:bg-border'
          : ''
      }`}
    >
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        value={value}
        placeholder={placeholder}
        list={list}
        onChange={(event) => onChange(event.target.value)}
        className="w-full border-0 bg-transparent py-0.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      />
    </div>
  );
}

function SearchField({
  id,
  label,
  value,
  onChange,
  divider = false,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  divider?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative min-w-0 rounded-2xl px-4 py-2 transition-colors focus-within:bg-muted hover:bg-muted sm:rounded-full sm:px-5 ${
        divider
          ? 'sm:before:absolute sm:before:left-0 sm:before:top-1/2 sm:before:h-7 sm:before:w-px sm:before:-translate-y-1/2 sm:before:bg-border'
          : ''
      }`}
    >
      <label htmlFor={id} className="block text-xs font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="dlu-hero-select w-full cursor-pointer appearance-none truncate border-0 bg-transparent py-0.5 pr-6 text-base text-muted-foreground outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 bottom-3 size-4 text-muted-foreground"
        aria-hidden
      />
    </div>
  );
}
