//
// Read-only review inbox for the signed-in instructor.

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { type ReviewItem, ReviewList } from '@/lib/contracts/reviews';

export function InstructorReviewInbox() {
  const t = useTranslations('dashboard.instructor.reviews');
  const locale = useLocale();
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [items, setItems] = useState<ReviewItem[]>([]);

  const load = useCallback(() => {
    setState('loading');
    apiFetch('/api/instructors/me/reviews', { schema: ReviewList })
      .then((data) => {
        setItems(data.items);
        setState('ready');
      })
      .catch(() => setState('error'));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state === 'loading') return <Skeleton className="h-40 w-full rounded-xl" />;
  if (state === 'error') {
    return (
      <Card className="border-destructive/30 bg-card">
        <CardContent className="flex items-center justify-between gap-4 p-6">
          <p className="text-small text-muted-foreground">{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={load}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h2 className="font-display text-h3 tracking-tight">{t('title')}</h2>
          <p className="mt-1 max-w-2xl text-small text-muted-foreground">{t('lead')}</p>
        </div>
        <p className="text-caption uppercase tracking-[0.12em] text-muted-foreground">
          {t('count', { count: items.length })}
        </p>
      </div>
      {items.length === 0 ? (
        <Card className="surface-panel border-border bg-card">
          <CardContent className="grid gap-2 p-6 text-small text-muted-foreground">
            <p className="font-medium text-foreground">{t('empty')}</p>
            <p>{t('emptyBody')}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="surface-card border-border bg-card">
                <CardContent className="grid gap-2 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-base font-semibold text-foreground">
                      {item.reviewerName}
                    </p>
                    <Badge variant="outline">
                      {t('rating', { rating: item.rating })}
                    </Badge>
                  </div>
                  <p className="text-small text-foreground">{item.comment}</p>
                  <p className="text-caption text-muted-foreground">
                    {formatDate(item.createdAt, locale)}
                  </p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      dateStyle: 'medium',
      timeZone: 'Europe/Stockholm',
    }).format(d);
  } catch {
    return iso;
  }
}
