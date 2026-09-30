'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export type PayoutsState = 'A' | 'B' | 'C' | 'D';

type Props = {
  /** Base path without trailing slash, e.g. `/api/orgs/{id}/connect`. */
  connectBasePath: string;
  i18nNamespace: 'schoolPayouts' | 'instructorPayouts';
  canManage: boolean;
  state: PayoutsState;
};

export function PayoutsCard({ connectBasePath, i18nNamespace, canManage, state }: Props) {
  const t = useTranslations(i18nNamespace);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startOnboarding() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(connectBasePath, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setError(t('errorGeneric'));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  async function openDashboard() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${connectBasePath}/dashboard`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setError(t('errorGeneric'));
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setError(t('errorGeneric'));
        return;
      }
      window.location.href = data.url;
    } catch {
      setError(t('errorGeneric'));
    } finally {
      setBusy(false);
    }
  }

  const title =
    state === 'A'
      ? t('stateA.title')
      : state === 'B'
        ? t('stateB.title')
        : state === 'C'
          ? t('stateC.title')
          : t('stateD.title');
  const body =
    state === 'A'
      ? t('stateA.body')
      : state === 'B'
        ? t('stateB.body')
        : state === 'C'
          ? t('stateC.body')
          : t('stateD.body');

  return (
    <Card className="border-border bg-card text-card-foreground">
      <CardContent className="grid gap-3 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-eyebrow text-muted-foreground">{t('title')}</p>
          {state === 'C' ? (
            <Badge
              variant="outline"
              className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
            >
              {t('stateC.badge')}
            </Badge>
          ) : null}
        </div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-small text-muted-foreground">{body}</p>
        {error ? <p className="text-small text-destructive">{error}</p> : null}
        {canManage && (state === 'A' || state === 'B') ? (
          <div>
            <Button type="button" size="sm" disabled={busy} onClick={() => void startOnboarding()}>
              {state === 'A' ? t('stateA.cta') : t('stateB.cta')}
            </Button>
          </div>
        ) : null}
        {canManage && state === 'C' ? (
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={() => void openDashboard()}
            >
              {t('stateC.dashboardCta')}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
