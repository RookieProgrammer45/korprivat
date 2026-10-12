import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export default async function NotFound() {
  const t = await getTranslations('publicRecovery.notFound');

  return (
    <main className="container mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="font-display text-4xl font-semibold tracking-tight">404 — {t('title')}</h1>
      <p className="text-muted-foreground">{t('description')}</p>
      <Link href="/" className="text-sm font-medium text-brand-500 underline">
        {t('action')}
      </Link>
    </main>
  );
}
