//
// The directory itself owns all filtering and data fetching. This wrapper only
// provides the learner-oriented heading and, for city routes, the initial city
// filter.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { InstructorDirectory } from '@/components/custom/instructor-directory';
import { Button } from '@/components/ui/button';
import type { CityHubKey } from '@/lib/seo/city-hubs';

export function PublicDirectoryPage({
  city,
  cityName,
}: {
  city?: CityHubKey;
  cityName?: string;
}) {
  const t = useTranslations('instructorsPage');
  const prefix = city ? `${city}City.header` : 'header';
  const title = t(`${prefix}.title`);
  const subtitle = t(`${prefix}.subtitle`);

  return (
    <main className="directory-shell container-page min-h-[calc(100dvh-3.5rem)] min-w-0">
      <header className="mx-auto flex w-full max-w-6xl flex-col gap-3">
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
