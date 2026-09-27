'use client';

import { Info, RotateCw } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { DashboardCard } from '@/components/custom/dashboard/dashboard-card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { apiFetch } from '@/lib/api-client';
import {
  ProviderActivationResponse,
  type ProviderActivationResponse as ProviderActivationResponseType,
} from '@/lib/contracts/provider-activation';

export function ProviderActivationKpi() {
  const t = useTranslations('dashboard.providerActivation');
  const [data, setData] = useState<ProviderActivationResponseType | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try {
      const response = await apiFetch('/api/dashboard/provider-activation', {
        schema: ProviderActivationResponse,
      });
      setData(response);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const action = (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={t('tooltipLabel')}
          className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-brand-100 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:bg-brand-900 dark:hover:text-brand-300"
        >
          <Info aria-hidden="true" className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs leading-relaxed">{t('tooltip')}</TooltipContent>
    </Tooltip>
  );

  return (
    <DashboardCard title={t('title')} description={t('description')} action={action}>
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
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="grid gap-1">
            <p className="font-display text-display leading-none tracking-tight text-foreground">
              {t('count', { count: data.activatedCount })}
            </p>
            <p className="text-small font-medium text-muted-foreground">
              {data.trend.status === 'neutral' ? t('trendNeutral') : t('trendConfirmed')}
            </p>
          </div>
          <span className="rounded-full border border-brand-500/30 bg-brand-100/70 px-3 py-1 text-eyebrow text-brand-700 dark:bg-brand-900/50 dark:text-brand-300">
            {t('liveLabel')}
          </span>
        </div>
      ) : (
        <output className="grid gap-3" aria-busy="true" aria-label={t('loading')}>
          <div className="h-12 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-48 animate-pulse rounded bg-muted" />
        </output>
      )}
    </DashboardCard>
  );
}
