//
// This island is shared by the home page and the provider-facing preview. It
// uses the same public list contract as the directory and links every card to
// the learner-facing profile, with no operational or social-proof metrics.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { SchoolContactActions } from '@/components/custom/school-contact-button';
import {
  SCHOOL_LISTING_GRID_CLASS,
  SchoolListingCard,
} from '@/components/custom/school-listing-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { type InstructorFilteredItem, InstructorList } from '@/lib/contracts/instructors';
import { schoolPath } from '@/lib/seo/school-slugs';

export { categoryChipLabel, SchoolMark } from '@/components/custom/school-listing-card';

const MAX_PREVIEW_ROWS = 20;

type Status = 'loading' | 'ready' | 'empty' | 'error';

export function InstructorPreview({
  limit = MAX_PREVIEW_ROWS,
  pageIntro = false,
  showContact = true,
  initialRows,
}: {
  limit?: number;
  pageIntro?: boolean;
  showContact?: boolean;
  /** Schools already rendered by the server. When set, the card does not fetch again. */
  initialRows?: InstructorFilteredItem[];
}) {
  const tr = useTranslations('instructorPreview');
  const seeded = initialRows !== undefined;
  const [status, setStatus] = useState<Status>(
    seeded ? (initialRows.length > 0 ? 'ready' : 'empty') : 'loading',
  );
  const [rows, setRows] = useState<InstructorFilteredItem[]>(initialRows ?? []);

  useEffect(() => {
    if (seeded) return;
    let active = true;
    apiFetch(`/api/instructors?limit=${Math.max(1, limit)}`, { schema: InstructorList })
      .then((data) => {
        if (!active) return;
        setRows(data.items.slice(0, Math.max(1, limit)));
        setStatus(data.items.length === 0 ? 'empty' : 'ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, [limit, seeded]);

  const content =
    status === 'loading' ? (
      <PreviewSkeleton limit={limit} />
    ) : status === 'error' ? (
      <p role="alert" className="text-small font-medium text-destructive">
        {tr('errorTitle')}
      </p>
    ) : status === 'empty' ? (
      <p className="text-small text-muted-foreground">{tr('empty')}</p>
    ) : (
      <ul className={SCHOOL_LISTING_GRID_CLASS}>
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              showContact ? 'grid h-full min-w-0 grid-rows-[1fr_auto] gap-2' : 'h-full min-w-0'
            }
          >
            <SchoolListingCard row={row} />
            {showContact ? (
              <div className="grid gap-2">
                <SchoolContactActions
                  name={row.name}
                  contact={row.contact}
                  priceRequest={row.priceRequest}
                  listing={schoolPath(row)}
                  size="sm"
                  className="w-full"
                />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    );

  if (!pageIntro) return content;

  return (
    <section className="grid min-w-0 gap-7">
      <header className="grid min-w-0 gap-2">
        <p className="text-eyebrow">{tr('pageEyebrow')}</p>
        <h1 className="font-display text-h1 leading-tight tracking-tight text-foreground">
          {tr('pageTitle')}
        </h1>
        <p className="max-w-2xl text-body-lg text-muted-foreground">{tr('pageBody')}</p>
      </header>
      {content}
      <div>
        <Button asChild size="lg">
          <Link href="/locations/se">{tr('directoryCta')}</Link>
        </Button>
      </div>
    </section>
  );
}

function PreviewSkeleton({ limit }: { limit: number }) {
  const ids = Array.from(
    { length: Math.min(Math.max(1, limit), MAX_PREVIEW_ROWS) },
    (_, index) => `preview-skeleton-${index + 1}`,
  );
  return (
    <ul className={SCHOOL_LISTING_GRID_CLASS}>
      {ids.map((skeletonId) => (
        <li key={skeletonId} aria-hidden>
          <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-white sm:rounded-[1.25rem] dark:bg-card">
            <Skeleton className="aspect-[5/3] w-full rounded-none sm:aspect-[4/3]" />
            <div className="flex flex-col gap-3 p-4">
              <Skeleton className="h-3 w-1/4" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-7 w-1/3" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
