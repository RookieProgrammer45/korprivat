'use client';

import { RotateCw } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { DashboardCard } from '@/components/custom/dashboard/dashboard-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type CompletedLessonItem,
  CompletedLessonsResponse,
  type CompletedLessonsResponse as CompletedLessonsResponseType,
} from '@/lib/contracts/completed-lessons';

export function CompletedLessonsCard() {
  const t = useTranslations('dashboard.completedLessons');
  const locale = useLocale();
  const [data, setData] = useState<CompletedLessonsResponseType | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await apiFetch('/api/dashboard/completed-lessons', {
        schema: CompletedLessonsResponse,
      });
      setData(response);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roleLabel =
    data?.providerRole === 'HANDLEDARE'
      ? t('roles.HANDLEDARE')
      : data?.providerRole === 'INSTRUCTOR'
        ? t('roles.INSTRUCTOR')
        : null;

  return (
    <DashboardCard
      title={t('title')}
      description={t('description')}
      action={roleLabel ? <Badge variant="secondary">{roleLabel}</Badge> : undefined}
    >
      {error ? (
        <div className="grid gap-3 rounded-[calc(var(--radius)-0.1rem)] border border-destructive/30 bg-destructive/5 p-4">
          <p role="alert" className="text-small font-medium text-destructive">
            {t('error')}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RotateCw aria-hidden="true" className="size-4" />
            {t('retry')}
          </Button>
        </div>
      ) : data ? (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="font-display text-display leading-none tracking-tight text-foreground">
              {t('count', { count: data.count })}
            </p>
            <Badge
              variant="outline"
              className="border-brand-500/30 text-brand-700 dark:text-brand-300"
            >
              {t('completedLabel')}
            </Badge>
          </div>

          <div className="grid gap-2">
            <p className="text-eyebrow text-muted-foreground">{t('recentTitle')}</p>
            {data.items.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4">
                <p className="text-small font-medium text-foreground">{t('emptyTitle')}</p>
                <p className="mt-1 text-caption text-muted-foreground">{t('emptyBody')}</p>
              </div>
            ) : (
              <ul className="grid gap-2" aria-label={t('recentTitle')}>
                {data.items.map((item) => (
                  <LessonRow key={item.id} item={item} locale={locale} t={t} />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <div className="grid gap-3" aria-busy="true">
          <span className="sr-only">{t('loading')}</span>
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      )}
    </DashboardCard>
  );
}

function LessonRow({
  item,
  locale,
  t,
}: {
  item: CompletedLessonItem;
  locale: string;
  t: ReturnType<typeof useTranslations<'dashboard.completedLessons'>>;
}) {
  return (
    <li className="grid gap-1 rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-3">
      <div className="min-w-0">
        <p className="truncate text-small font-medium text-foreground">{item.learnerName}</p>
        <p className="text-caption text-muted-foreground">
          <Badge variant="outline" className="mr-1.5 align-middle px-1.5 py-0 text-[10px]">
            {item.category}
          </Badge>
          {t('lessonDate', { date: formatDate(item.lessonDate, locale) })}
        </p>
      </div>
      <time
        dateTime={item.completionDate}
        className="text-caption text-muted-foreground sm:text-right"
      >
        {t('completedDate', { date: formatDate(item.completionDate, locale) })}
      </time>
    </li>
  );
}

function formatDate(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso));
}
