//
// This is an entry point, not an operational dashboard. Credentials, safety,
// account setup, and scheduling details remain behind the existing authenticated
// flow.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const ROLE_KEYS = ['trafiklarare', 'commission'] as const;

export function ProviderEntry() {
  const t = useTranslations('providerEntry');
  return (
    <main className="provider-entry-shell container-page section min-h-[calc(100dvh-3.5rem)]">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:gap-20">
        <header className="provider-entry-copy grid gap-4">
          <Badge
            variant="outline"
            className="w-fit border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
          >
            {t('eyebrow')}
          </Badge>
          <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
            {t('title')}
          </h1>
          <p className="text-body-lg text-muted-foreground">{t('body')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/instructors/new">{t('primaryCta')}</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/instructors">{t('learnerCta')}</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-4">
          <p className="text-eyebrow">{t('rolesEyebrow')}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {ROLE_KEYS.map((role) => (
              <Card key={role} className="border-border bg-card">
                <CardContent className="grid gap-3 p-6">
                  <h2 className="font-display text-h3 tracking-tight text-foreground">
                    {t(`roles.${role}.title`)}
                  </h2>
                  <p className="text-small leading-relaxed text-muted-foreground">
                    {t(`roles.${role}.body`)}
                  </p>
                  <p className="border-t border-border pt-3 text-small text-foreground">
                    {t(`roles.${role}.expectation`)}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="surface-card border-brand-500/25 bg-brand-100 dark:bg-brand-900">
            <CardContent className="grid gap-2 p-6">
              <h2 className="font-display text-h3 tracking-tight text-foreground">
                {t('safety.title')}
              </h2>
              <p className="text-small leading-relaxed text-muted-foreground">{t('safety.body')}</p>
              <p className="text-small leading-relaxed text-foreground">{t('safety.review')}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
