// Home hero — search-first marketplace entry.
//
// Design: .cursor/rules/design-system.mdc (bone/ink/one green accent, search
// leads, real imagery). Honesty: the overlay chips state only product facts
// that hold for every listing; no invented names, prices, ratings or slots.
// The listing/booking-authorization clarification is kept once, as a footnote.

'use client';

import { ArrowRight, Check, ChevronDown, Search } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useState } from 'react';

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
  { key: 'categoryB', href: '/instructors?categories=B' },
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
      <div className="container-page grid min-w-0 items-center gap-12 pt-10 pb-16 sm:pt-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pt-16 lg:pb-20">
        {/* Copy + search */}
        <div className="marketplace-reveal flex min-w-0 flex-col">
          <p className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-[var(--dlu-green)]" aria-hidden />
            {t('marketplaceTag')}
          </p>

          <h1 className="marketplace-hero-title mt-6 max-w-[15ch] font-display text-[2.6rem] leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-6xl xl:text-[4.25rem]">
            {t('title')}
          </h1>

          <p className="mt-5 max-w-xl text-body-lg text-muted-foreground">{t('lead')}</p>

          <form
            onSubmit={onSubmit}
            aria-label={t('search.label')}
            className="dlu-hero-search mt-8 grid w-full max-w-2xl gap-1 rounded-[1.25rem] border border-border bg-card p-2 sm:grid-cols-[1fr_1.25fr_auto] sm:items-center sm:rounded-full sm:p-1.5 sm:pl-2"
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
              className="marketplace-primary-cta mt-1 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-foreground px-6 text-base text-background transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 sm:mt-0 sm:h-14 sm:px-7"
            >
              <Search className="size-4" strokeWidth={2} aria-hidden />
              {t('search.submit')}
            </button>
          </form>

          <div className="mt-5 flex min-w-0 flex-wrap items-center gap-2 text-sm">
            <span className="mr-1 text-muted-foreground">{t('popular.label')}</span>
            {POPULAR_LINKS.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                className="rounded-full border border-border bg-card px-3.5 py-1.5 text-foreground transition-colors hover:border-foreground/25"
              >
                {t(`popular.links.${link.key}`)}
              </Link>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
            <p className="flex items-center gap-2 text-sm text-foreground">
              <Check
                className="size-4 shrink-0 text-[var(--dlu-green)]"
                strokeWidth={2.25}
                aria-hidden
              />
              {t('assurance.choice')}
            </p>
            <Link
              href="/for-skolor"
              className="group inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
            >
              {t('schoolLink')}
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground">{t('note')}</p>
        </div>

        {/* Visual */}
        <div className="marketplace-reveal dlu-hero-visual relative min-w-0">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] sm:aspect-[16/11] lg:aspect-[6/7] border border-border bg-muted">
            <Image
              src="/images/hero-road.webp"
              alt={t('imageAlt')}
              fill
              priority
              sizes="(min-width: 1024px) 34rem, 100vw"
              className="object-cover object-[50%_32%]"
            />
          </div>

          <HeroChip className="left-4 top-4 lg:-left-8 lg:top-10" text={t('chips.price')} />
          <HeroChip
            className="bottom-4 right-4 lg:-right-6 lg:bottom-12"
            text={t('chips.cancellation')}
          />
        </div>
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
        className="dlu-hero-select w-full cursor-pointer appearance-none truncate border-0 bg-transparent py-0.5 pr-6 text-base text-muted-foreground outline-none focus-visible:outline-none"
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

function HeroChip({ text, className }: { text: string; className: string }) {
  return (
    <div
      className={`dlu-hero-chip absolute flex max-w-[calc(100%-2rem)] items-center whitespace-nowrap max-sm:whitespace-normal gap-2.5 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm text-foreground ${className}`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--dlu-green-chip)] text-[var(--dlu-green-deep)]">
        <Check className="size-4" strokeWidth={2.25} aria-hidden />
      </span>
      <span className="leading-snug">{text}</span>
    </div>
  );
}
