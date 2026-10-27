// Search-first entry. Desktop-only photograph sits to the right of the copy.

'use client';

import { ChevronDown, Search, Truck } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';
import { AnimatedTitle } from '@/components/custom/animated-title';

const SEARCH_CATEGORIES = ['B', 'A', 'BE'] as const;

// Values are the Swedish city names stored on listings (the API expands
// variants via cityFilterCandidates); labels come from i18n.
const SEARCH_CITIES = [
  { id: 'stockholm', value: 'Stockholm' },
  { id: 'goteborg', value: 'Göteborg' },
  { id: 'malmo', value: 'Malmö' },
  { id: 'uppsala', value: 'Uppsala' },
  { id: 'vasteras', value: 'Västerås' },
  { id: 'linkoping', value: 'Linköping' },
  { id: 'orebro', value: 'Örebro' },
  { id: 'helsingborg', value: 'Helsingborg' },
] as const;

const POPULAR_LINKS = [
  { key: 'heavy', href: '/tung-trafik' },
  { key: 'categoryA', href: '/instructors?categories=A' },
  { key: 'stockholm', href: '/locations/se/stockholm' },
  { key: 'goteborg', href: '/locations/se/goteborg' },
  { key: 'malmo', href: '/locations/se/malmo' },
] as const;

export function HomeHero() {
  const t = useTranslations('publicHome.hero');
  const router = useRouter();
  const categoryId = useId();
  const cityId = useId();
  const [category, setCategory] = useState<string>('B');
  const [city, setCity] = useState<string>('');

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Only send non-empty params: the shared parser rejects `city=`.
    const params = new URLSearchParams();
    if (category) params.set('categories', category);
    if (city) params.set('city', city);
    const qs = params.toString();
    router.push(qs ? `/instructors?${qs}` : '/instructors');
  }

  return (
    <section className="marketplace-hero dlu-hero border-b border-border">
      <div className="container-page grid items-center gap-10 pt-12 pb-10 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20 lg:pb-14">
        <div className="dlu-hero-copy flex min-w-0 flex-col">
          <AnimatedTitle
            text={t('title')}
            className="marketplace-hero-title max-w-[15ch] font-display text-[2.6rem] leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-6xl xl:text-[4.25rem]"
          />

          <form
            onSubmit={onSubmit}
            aria-label={t('search.label')}
            className="marketplace-reveal dlu-hero-in-2 dlu-hero-search mt-8 grid w-full max-w-2xl gap-1 rounded-[1.25rem] border border-border bg-card p-2 sm:grid-cols-[1fr_1.25fr_auto] sm:items-center sm:rounded-full sm:p-1.5 sm:pl-2"
          >
            <SearchField
              id={categoryId}
              label={t('search.categoryLabel')}
              value={category}
              onChange={setCategory}
            >
              {SEARCH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`search.categories.${c}`)}
                </option>
              ))}
            </SearchField>

            <div className="mx-4 h-px bg-border sm:hidden" aria-hidden />

            <SearchField
              id={cityId}
              label={t('search.cityLabel')}
              value={city}
              onChange={setCity}
              divider
            >
              <option value="">{t('search.cityAny')}</option>
              {SEARCH_CITIES.map((c) => (
                <option key={c.id} value={c.value}>
                  {t(`search.cities.${c.id}`)}
                </option>
              ))}
            </SearchField>

            <button
              type="submit"
              className="dlu-ink-pill mt-1 cursor-pointer justify-center border-0 sm:mt-0"
            >
              <Search className="size-4" strokeWidth={2} aria-hidden />
              {t('search.submit')}
            </button>
          </form>

          <div className="marketplace-reveal dlu-hero-in-3 mt-5 flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-muted-foreground">{t('popular.label')}</span>
            {POPULAR_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="dlu-hero-popular-link inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
              >
                {link.key === 'heavy' ? (
                  <Truck className="size-4" strokeWidth={1.75} aria-hidden />
                ) : null}
                {t(`popular.links.${link.key}`)}
              </Link>
            ))}
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
        </aside>
      </div>
    </section>
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
        onChange={(e) => onChange(e.target.value)}
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
