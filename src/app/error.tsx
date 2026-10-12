'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

export default function RouteError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('publicRecovery.routeError');

  return (
    <main className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Button onClick={() => reset()}>{t('action')}</Button>
    </main>
  );
}
