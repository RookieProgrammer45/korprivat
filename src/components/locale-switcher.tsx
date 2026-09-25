// @polsia:user-owned — language switcher; style/place freely (drop it in your nav,
// under <I18nProvider>). POSTs /api/locale to set the cookie, then refreshes.
'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { locales } from '@/i18n/config';
import { apiFetch } from '@/lib/api-client';

export function LocaleSwitcher() {
  const current = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function select(locale: string) {
    if (locale === current) return;
    startTransition(async () => {
      try {
        await apiFetch('/api/locale', {
          method: 'POST',
          body: JSON.stringify({ locale }),
        });
        router.refresh();
      } catch {
        toast.error(t('nav.languageError'));
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending || locale === current}
          onClick={() => select(locale)}
          aria-current={locale === current}
          className="rounded-full border border-border px-3 py-1.5 text-caption font-bold uppercase tracking-[0.08em] transition-colors hover:border-brand-400 hover:bg-brand-100 disabled:bg-brand-100 disabled:text-brand-700 disabled:opacity-100 dark:hover:bg-brand-900 dark:disabled:bg-brand-900 dark:disabled:text-brand-300"
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
