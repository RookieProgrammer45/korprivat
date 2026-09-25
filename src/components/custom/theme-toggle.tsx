// @polsia:user-owned — light/dark theme toggle. Reusable; mounted in SiteNav.

'use client';

import { Moon, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations('common');
  return (
    <Button
      variant="ghost"
      size="icon"
      className={`rounded-full border border-border bg-card text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-brand-700 dark:hover:bg-brand-900 dark:hover:text-brand-300 ${className ?? ''}`}
      aria-label={t('nav.themeAria')}
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {/* Visibility is driven by the `.dark` class (set by next-themes outside React),
          not React state — so server and client markup match and there's no flash. */}
      <Sun className="block dark:hidden" />
      <Moon className="hidden dark:block" />
    </Button>
  );
}
