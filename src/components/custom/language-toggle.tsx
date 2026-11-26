// One language control for every viewport. Choosing a language writes the
// cookie and client-navigates to the prefixed URL. The menu prefetches those
// URLs when it opens, and the proxy rewrites them, so the page swaps in place.

'use client';

import { Languages } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales } from '@/i18n/config';
import { writeLocaleCookie } from '@/lib/locale-cookie';
import { switchLocalePath } from '@/lib/seo/locale-path';

const LOCALE_SHORT: Record<(typeof locales)[number], string> = Object.fromEntries(
  locales.map((locale) => [locale, locale.toUpperCase()]),
) as Record<(typeof locales)[number], string>;

export function LanguageToggle(props: {
  className?: string;
  align?: 'start' | 'end';
  showCode?: boolean;
}) {
  return (
    <Suspense fallback={<LanguageToggleButton {...props} />}>
      <LanguageToggleMenu {...props} />
    </Suspense>
  );
}

function LanguageToggleButton({
  className,
  showCode = false,
}: {
  className?: string;
  align?: 'start' | 'end';
  showCode?: boolean;
}) {
  const t = useTranslations('common');
  const current = useLocale();
  return (
    <Button
      variant="ghost"
      size={showCode ? 'sm' : 'icon'}
      className={toggleClass(showCode, className)}
      aria-label={t('nav.languageAria')}
      type="button"
    >
      <Languages className="size-4 shrink-0" />
      {showCode ? (
        <span className="text-caption font-medium uppercase tracking-[0.08em]">
          {LOCALE_SHORT[current as (typeof locales)[number]] ?? current}
        </span>
      ) : null}
    </Button>
  );
}

function toggleClass(showCode: boolean, className?: string) {
  return showCode
    ? `shrink-0 gap-1.5 rounded-full border border-border bg-card px-2.5 text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900 dark:hover:text-brand-300 ${className ?? ''}`
    : `rounded-full border border-border bg-card text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900 dark:hover:text-brand-300 ${className ?? ''}`;
}

function LanguageToggleMenu({
  className,
  align = 'end',
  showCode = false,
}: {
  className?: string;
  align?: 'start' | 'end';
  /** Auth/dashboard: show the active code (SV) beside the icon so the control stays one control wide. */
  showCode?: boolean;
}) {
  const current = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('common');
  const search = searchParams.toString();

  function hrefFor(locale: (typeof locales)[number]) {
    return switchLocalePath(pathname, locale, search ? `?${search}` : '');
  }

  function prefetchLocales() {
    for (const locale of locales) {
      if (locale === current) continue;
      router.prefetch(hrefFor(locale));
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && prefetchLocales()}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size={showCode ? 'sm' : 'icon'}
          className={toggleClass(showCode, className)}
          aria-label={t('nav.languageAria')}
        >
          <Languages className="size-4 shrink-0" />
          {showCode ? (
            <span className="text-caption font-medium uppercase tracking-[0.08em]">
              {LOCALE_SHORT[current as (typeof locales)[number]] ?? current}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-[12rem]">
        {locales.map((locale) => {
          const active = locale === current;
          const label = (
            <>
              <span className="font-medium">{LOCALE_SHORT[locale]}</span>
              <span className="text-caption text-muted-foreground">{t(`language.${locale}`)}</span>
            </>
          );
          if (active) {
            return (
              <DropdownMenuItem
                key={locale}
                disabled
                className="flex w-full items-center justify-between gap-3"
              >
                {label}
              </DropdownMenuItem>
            );
          }
          return (
            <DropdownMenuItem
              key={locale}
              className="flex w-full cursor-pointer items-center justify-between gap-3"
              onSelect={() => {
                writeLocaleCookie(locale);
                router.push(hrefFor(locale));
                // The locale URL rewrites to the same page. Push changes the
                // address; refresh pulls the translated server render into it.
                router.refresh();
              }}
            >
              {label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
