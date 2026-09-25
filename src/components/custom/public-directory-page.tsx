// @polsia:user-owned — localized directory page composition.
//
// The directory itself owns all filtering and data fetching. This wrapper only
// provides the learner-oriented heading and, for city routes, the initial city
// filter.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { InstructorDirectory } from '@/components/custom/instructor-directory';
import { Button } from '@/components/ui/button';

type CityKey = 'stockholm' | 'goteborg' | 'malmo' | 'uppsala' | 'vasteras';

export function PublicDirectoryPage({ city, cityName }: { city?: CityKey; cityName?: string }) {
  const t = useTranslations('instructorsPage');
  const prefix = city ? `${city}City.header` : 'header';
  const title = t(`${prefix}.title`);
  const subtitle = t(`${prefix}.subtitle`);

  return (
    <main className="directory-shell container-page section min-h-[calc(100dvh-3.5rem)]">
      <header className="mx-auto flex max-w-3xl flex-col gap-3">
        <p className="text-eyebrow">{t(`${prefix}.eyebrow`)}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
          {title}
        </h1>
        <p className="max-w-2xl text-body-lg text-muted-foreground">{subtitle}</p>
        {city ? (
          <Button asChild variant="ghost" size="sm" className="w-fit px-0 text-foreground">
            <Link href="/instructors">{t('directoryCta')}</Link>
          </Button>
        ) : null}
      </header>
      <InstructorDirectory initialFilters={cityName ? { city: cityName } : undefined} />
    </main>
  );
}
