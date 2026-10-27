'use client';

import { Truck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { InstructorDirectory } from '@/components/custom/instructor-directory';

export function HeavyVehiclesPage() {
  const t = useTranslations('heavyVehiclesPage');
  return (
    <main className="directory-shell container-page min-h-[calc(100dvh-3.5rem)] min-w-0">
      <header className="mx-auto flex w-full max-w-6xl items-start gap-4">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground">
          <Truck className="size-7" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="grid min-w-0 gap-3">
          <p className="text-eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">{t('subtitle')}</p>
        </div>
      </header>
      <InstructorDirectory initialFilters={{ heavy: 'all' }} heavyScope />
    </main>
  );
}
