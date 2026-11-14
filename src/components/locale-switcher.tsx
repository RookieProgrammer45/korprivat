// under <I18nProvider>). POSTs /api/locale to set the cookie, then navigates
// to the prefixed (or unprefixed Swedish) URL so crawlers and users share unique URLs.
'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { locales } from '@/i18n/config';
import { apiFetch } from '@/lib/api-client';
import { switchLocalePath } from '@/lib/seo/locale-path';

export function LocaleSwitcher() {
  const current = useLocale();
  const t = useTranslations('common');
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function select(locale: string) {
    if (locale === current) return;
    startTransition(async () => {
      try {
        await apiFetch('/api/locale', {
          method: 'POST',
          body: JSON.stringify({ locale }),
        });
        router.push(switchLocalePath(pathname, locale, window.location.search));
      } catch {
        toast.error(t('nav.languageError'));
      }
    });
  }

  return (
    <div className="flex max-w-xs flex-wrap items-center justify-end gap-1">
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={pending || locale === current}
          onClick={() => select(locale)}
          aria-current={locale === current}
          className="rounded-full border border-border px-2.5 py-1 text-caption font-bold uppercase tracking-[0.08em] transition-colors hover:border-brand-400 hover:bg-brand-100 disabled:bg-brand-100 disabled:text-brand-700 disabled:opacity-100 dark:hover:bg-brand-900 dark:disabled:bg-brand-900 dark:disabled:text-brand-300"
        >
          {locale}
        </button>
      ))}
    </div>
  );
}
