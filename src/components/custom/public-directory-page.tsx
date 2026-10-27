//
// The directory itself owns all filtering and data fetching. This wrapper only
// provides the learner-oriented heading and, for city routes, the initial city
// filter. Server-rendered children (e.g. the crawlable PublicDirectorySeo
// index) render inside <main> below the interactive directory.

'use client';

import { Car } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { InstructorDirectory } from '@/components/custom/instructor-directory';
import { Button } from '@/components/ui/button';
import type { CityHubKey } from '@/lib/seo/city-hubs';

export function PublicDirectoryPage({
  city,
  cityName,
  children,
}: {
  city?: CityHubKey;
  cityName?: string;
  children?: ReactNode;
}) {
  const t = useTranslations('instructorsPage');
  const prefix = city ? `${city}City.header` : 'header';
  const title = t(`${prefix}.title`);
  const subtitle = t(`${prefix}.subtitle`);

  return (
    <main className="directory-shell container-page min-h-[calc(100dvh-3.5rem)] min-w-0">
      <header className="mx-auto flex w-full max-w-6xl items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground">
          <Car className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="grid min-w-0 gap-3">
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
        </div>
      </header>
      <InstructorDirectory initialFilters={cityName ? { city: cityName } : undefined} />
      {children}
    </main>
  );
}
