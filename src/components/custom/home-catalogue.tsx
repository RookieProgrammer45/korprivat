'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { rememberCatalogueOpen } from '@/components/custom/catalogue-outbound-link';
import { type HomeCatalogueMode, HomeHero } from '@/components/custom/home-hero';
import { InstructorPreview } from '@/components/custom/instructor-preview';
import { SCHOOL_LISTING_GRID_CLASS } from '@/components/custom/school-listing-grid';
import { LocaleLink as Link } from '@/components/locale-link';
import { HOMEPAGE_SCHOOL_PREVIEW_LIMIT } from '@/lib/catalog-preview';
import type { InstructorFilteredItem } from '@/lib/contracts/instructors';
import { intlLocale } from '@/lib/intl-locale';

export type HomeOfferCard = {
  id: string;
  learn: 'car' | 'part';
  href: string;
  place: string;
  name: string;
  price: number;
  currency: string;
  imageUrl: string | null;
  spec: string | null;
};

export function HomeCatalogue({
  schools,
  cars,
  parts,
  dealerCities,
  lessonFrom,
  vehicleFrom,
  schoolsEmptyLabel,
}: {
  schools: InstructorFilteredItem[] | undefined;
  cars: HomeOfferCard[];
  parts: HomeOfferCard[];
  dealerCities: readonly string[];
  lessonFrom: number | null;
  vehicleFrom: { amount: number; currency: string } | null;
  schoolsEmptyLabel?: string;
}) {
  const [mode, setMode] = useState<HomeCatalogueMode>('school');
  const t = useTranslations('publicHome');
  const offers = mode === 'dealer' ? cars : parts;
  const heading =
    mode === 'dealer'
      ? t('providers.carsTitle')
      : mode === 'parts'
        ? t('providers.partsTitle')
        : t('providers.title');
  const cta =
    mode === 'dealer'
      ? t('providers.carsCta')
      : mode === 'parts'
        ? t('providers.partsCta')
        : t('providers.cta');
  const href =
    mode === 'dealer' ? '/bilhandlare' : mode === 'parts' ? '/reservdelar' : '/locations';
  const empty =
    mode === 'dealer'
      ? t('providers.carsEmpty')
      : mode === 'parts'
        ? t('providers.partsEmpty')
        : '';

  return (
    <>
      <HomeHero
        mode={mode}
        onModeChange={setMode}
        dealerCities={dealerCities}
        lessonFrom={lessonFrom}
        vehicleFrom={vehicleFrom}
      />
      <section className="border-t border-border" data-catalogue-mode={mode}>
        <div className="container-page grid min-w-0 gap-6 py-10 lg:py-14">
          <div className="flex min-w-0 items-end justify-between gap-4">
            <h2 className="font-display text-h2 font-normal leading-tight tracking-tight text-foreground">
              {heading}
            </h2>
            <Link href={href} className="dlu-text-link shrink-0">
              {cta}
            </Link>
          </div>
          {mode === 'school' ? (
            <InstructorPreview
              limit={HOMEPAGE_SCHOOL_PREVIEW_LIMIT}
              initialRows={schools}
              showContact={false}
              emptyLabel={schoolsEmptyLabel}
            />
          ) : offers.length > 0 ? (
            <ul className={SCHOOL_LISTING_GRID_CLASS}>
              {offers.map((offer) => (
                <li key={offer.id} className="h-full min-w-0">
                  <OfferCard offer={offer} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-small text-muted-foreground">{empty}</p>
          )}
        </div>
      </section>
    </>
  );
}

function OfferCard({ offer }: { offer: HomeOfferCard }) {
  const locale = useLocale();
  const [failed, setFailed] = useState(false);
  const photo = offer.imageUrl && !failed;
  const price = `${new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 2 }).format(offer.price)} ${offer.currency}`;

  return (
    <Link
      href={offer.href}
      onClick={() => rememberCatalogueOpen(offer.learn, offer.id)}
      className="group block h-full min-w-0 rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition-[transform,box-shadow,border-color] duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/20 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 sm:rounded-[1.25rem] dark:bg-card">
        <span className="dlu-school-photo dlu-school-photo--compact">
          {photo ? (
            // biome-ignore lint/performance/noImgElement: the photo is hosted by the seller
            <img
              src={offer.imageUrl ?? ''}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailed(true)}
              className="absolute inset-0 h-full w-full object-contain p-3"
            />
          ) : (
            <span className="flex h-full items-center justify-center font-display text-lg font-normal text-foreground">
              {offer.name.slice(0, 1)}
            </span>
          )}
        </span>
        <div className="flex flex-1 flex-col gap-2 p-3 sm:gap-2.5 sm:p-4">
          <div className="min-w-0">
            <p className="truncate text-[11px] leading-snug text-muted-foreground sm:text-small">
              {offer.place}
            </p>
            <h3 className="line-clamp-2 break-words font-display text-sm font-normal leading-snug tracking-tight text-foreground sm:text-h4 sm:leading-normal">
              {offer.name}
            </h3>
          </div>
          <p className="dlu-school-price break-words">{price}</p>
          {offer.spec ? (
            <div className="mt-auto flex">
              <span className="dlu-chip max-w-full truncate">{offer.spec}</span>
            </div>
          ) : null}
        </div>
      </article>
    </Link>
  );
}
