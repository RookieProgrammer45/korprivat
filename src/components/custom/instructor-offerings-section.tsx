'use client';
import { useTranslations } from 'next-intl';
//
// Public offerings price list on the instructor profile. Fetches its own
// data and renders NOTHING (null) when the school has no active offerings,
// so profiles without offerings stay byte-identical to before this feature.
import { useEffect, useState } from 'react';
import { InstructorOfferingsRequestForm } from '@/components/custom/instructor-offerings-request-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { type PublicOffering, PublicOfferingList } from '@/lib/contracts/offerings';

type Status = { kind: 'loading' } | { kind: 'hidden' } | { kind: 'ready'; items: PublicOffering[] };

export function InstructorOfferingsSection({
  instructorId,
  requestEnabled = true,
}: {
  instructorId: string;
  // false for directory-only ('contact') listings: prices render, the
  // per-offering request form does not.
  requestEnabled?: boolean;
}) {
  const tr = useTranslations('offerings.section');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch(`/api/instructors/${encodeURIComponent(instructorId)}/offerings`, {
      schema: PublicOfferingList,
    })
      .then((data) => {
        if (!active) return;
        setStatus(
          data.items.length > 0 ? { kind: 'ready', items: data.items } : { kind: 'hidden' },
        );
      })
      .catch(() => {
        if (active) setStatus({ kind: 'hidden' });
      });
    return () => {
      active = false;
    };
  }, [instructorId]);

  if (status.kind === 'loading') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="grid gap-3 p-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }
  if (status.kind === 'hidden') return null;

  return (
    <Card className="surface-panel min-w-0 border-border bg-card">
      <CardContent className="grid min-w-0 gap-4 p-6">
        <div className="grid gap-1">
          <p className="text-eyebrow text-muted-foreground">{tr('eyebrow')}</p>
          <h2 className="font-display text-h3 tracking-tight text-foreground">{tr('title')}</h2>
          <p className="text-small text-muted-foreground">{tr('lead')}</p>
        </div>
        <div className="grid gap-3">
          {status.items.map((offering) => (
            <OfferingRow
              key={offering.id}
              instructorId={instructorId}
              offering={offering}
              requestEnabled={requestEnabled}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function OfferingRow({
  instructorId,
  offering,
  requestEnabled,
}: {
  instructorId: string;
  offering: PublicOffering;
  requestEnabled: boolean;
}) {
  const tr = useTranslations('offerings.section');
  const [open, setOpen] = useState(false);
  const kindKey =
    offering.kind === 'LEKTION'
      ? ('kind.LEKTION' as const)
      : offering.kind === 'INTENSIVKURS'
        ? ('kind.INTENSIVKURS' as const)
        : ('kind.PAKET' as const);
  const meta: string[] = [];
  if (offering.sessions != null) meta.push(tr('sessionsCount', { count: offering.sessions }));
  if (offering.weeks != null) meta.push(tr('weeksCount', { count: offering.weeks }));

  return (
    <div className="grid min-w-0 gap-3 rounded-lg border border-border p-4">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 max-sm:flex-auto items-center gap-3">
          <Badge variant="secondary" className="shrink-0">
            {tr(kindKey)}
          </Badge>
          <div className="min-w-0">
            <p className="text-small font-medium text-foreground">{offering.name}</p>
            {meta.length > 0 ? (
              <p className="text-caption text-muted-foreground">{meta.join(' · ')}</p>
            ) : null}
          </div>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          <span className="text-small font-medium text-foreground">
            {tr('priceFrom', { price: offering.priceSek })}
          </span>
          {!open && requestEnabled ? (
            <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
              {tr('requestCta')}
            </Button>
          ) : null}
        </div>
      </div>
      {offering.description ? (
        <p className="text-small text-muted-foreground">{offering.description}</p>
      ) : null}
      {open ? (
        <InstructorOfferingsRequestForm
          instructorId={instructorId}
          offering={offering}
          onDone={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
