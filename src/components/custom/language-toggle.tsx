// @polsia:user-owned — site-wide Swedish/English toggle. Mirrors <ThemeToggle/>'s
// icon-button / dropdown pattern so the two sit visually balanced next to each
// other in the right-hand cluster of the header. Switching writes the
// `NEXT_LOCALE` cookie via the installed POST /api/locale lane and then refreshes
// the current page so its translated strings re-render.

'use client';

import { Languages } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales } from '@/i18n/config';
import { apiFetch } from '@/lib/api-client';

const LOCALE_SHORT: Record<(typeof locales)[number], string> = {
  sv: 'SV',
  en: 'EN',
};

export function LanguageToggle({
  className,
  align = 'end',
}: {
  className?: string;
  align?: 'start' | 'end';
}) {
  const current = useLocale();
  const router = useRouter();
  const t = useTranslations('common');
  const [pending, startTransition] = useTransition();

  function select(locale: (typeof locales)[number]) {
    if (locale === current || pending) return;
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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full border border-border bg-card text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900 dark:hover:text-brand-300 ${className ?? ''}`}
          aria-label={t('nav.languageAria')}
          aria-busy={pending}
        >
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {locales.map((locale) => {
          const active = locale === current;
          return (
            <DropdownMenuItem
              key={locale}
              disabled={pending || active}
              onSelect={(event) => {
                event.preventDefault();
                select(locale);
              }}
              className="flex w-full items-center justify-between gap-3"
            >
              <span className="font-medium">{LOCALE_SHORT[locale]}</span>
              <span className="text-caption text-muted-foreground">{t(`language.${locale}`)}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
