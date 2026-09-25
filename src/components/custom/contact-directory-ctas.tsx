// @polsia:user-owned — Contact page CTA cluster.
//
// Two brand-tinted buttons that give visitors a fast-path off the contact
// flow when they only came here to browse the directory (footer "Browse
// instructors" link, deep-link from blog CTAs, etc.). The cluster reads the
// canonical live count from the existing /api/instructors contract with a
// `countOnly=1` short-circuit so it doesn't hydrate every row just to render
// a count line — the contract grew an optional `count` field to carry that
// value.
//
// Both buttons navigate to the existing instructor landing pages, so this
// island is render-only (no per-page state besides the loading count hint)
// and the parent SSR page can stay an HTML shell — no extra DB read inside
// the page, no `await prisma` in render layer. The buttons render no matter
// the count fetch state so a slow API never delays the primary conversion
// path.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { InstructorList } from '@/lib/contracts/instructors';

export function ContactDirectoryCtas() {
  const t = useTranslations('landing.contactPage.cta');

  // Best-effort count fetch — never blocks the button render. Defaults to
  // undefined so the subtitle line shows the count placeholder only when the
  // API returns a number we can trust. Errors here are expected (sandbox
  // placeholder keys, transient network) and silently degrade to a count-less
  // subtitle; the buttons remain clickable so the conversion path stays open.
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let active = true;
    apiFetch('/api/instructors?countOnly=1', { schema: InstructorList })
      .then((data) => {
        if (!active) return;
        if (typeof data.count === 'number') setCount(data.count);
      })
      .catch(() => {
        // Silent — buttons still render.
      });
    return () => {
      active = false;
    };
  }, []);

  const stockholmSubtitle =
    count != null
      ? t('browseStockholmSubtitle', { count })
      : t('browseStockholmSubtitle', { count: '—' });

  return (
    <Card className="surface-panel w-full min-w-0 border-border bg-card shadow-sm">
      <CardContent className="flex w-full min-w-0 flex-col gap-5 p-4 sm:p-8">
        <p className="min-w-0 break-words text-eyebrow">{t('eyebrow')}</p>
        <div className="flex w-full min-w-0 flex-col gap-4 sm:flex-row sm:items-stretch">
          <Button
            asChild
            size="lg"
            className="h-auto w-full min-w-0 max-w-full justify-start whitespace-normal py-3 shadow-sm sm:flex-1"
          >
            <Link href="/instructors/stockholm" className="flex w-full min-w-0">
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left whitespace-normal break-words">
                <span className="min-w-0 max-w-full break-words whitespace-normal font-display text-base font-semibold">
                  {t('browseStockholmTitle')}
                </span>
                <span className="min-w-0 max-w-full break-words whitespace-normal text-small font-medium text-primary-foreground/85">
                  {stockholmSubtitle}
                </span>
              </span>
              <span aria-hidden className="ml-auto shrink-0">
                →
              </span>
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-auto w-full min-w-0 max-w-full justify-start whitespace-normal border-brand-500/40 py-3 text-brand-700 hover:bg-brand-100 hover:text-brand-700 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-800 sm:flex-1"
          >
            <Link href="/instructors" className="flex w-full min-w-0">
              <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left whitespace-normal break-words">
                <span className="min-w-0 max-w-full break-words whitespace-normal font-display text-base font-semibold">
                  {t('browseAllTitle')}
                </span>
                <span className="min-w-0 max-w-full break-words whitespace-normal text-small font-medium text-muted-foreground">
                  {t('browseAllSubtitle')}
                </span>
              </span>
              <span aria-hidden className="ml-auto shrink-0">
                →
              </span>
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
