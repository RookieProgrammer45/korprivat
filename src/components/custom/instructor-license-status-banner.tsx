//
// On `/dashboard/instructor`, this island surfaces licence review state only:
//
//   NONE | PENDING — "pending review" empty state.
//   REJECTED        — rejection card with the admin's reason.
//   VERIFIED + no listing — "create your listing" CTA.
//   VERIFIED + listing    — render nothing (ops live on the page once).

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { LicenseStatusResponse } from '@/lib/contracts/instructor-license';

type BannerState =
  | { kind: 'loading' }
  | {
      kind: 'ready';
      status: 'NONE' | 'PENDING' | 'REJECTED';
      rejectionReason?: string;
    }
  | { kind: 'ready-verified-no-listing' }
  | { kind: 'ready-verified-has-listing' };

export function InstructorLicenseStatusBanner() {
  const t = useTranslations('dashboard.instructor.pendingLicense');
  const td = useTranslations('dashboard.instructor');
  const tcl = useTranslations('dashboard.instructor.createListing');
  const [state, setState] = useState<BannerState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;

    apiFetch('/api/instructor-license', { schema: LicenseStatusResponse })
      .then(async (data) => {
        if (!active) return;

        if (data.status !== 'VERIFIED') {
          setState({
            kind: 'ready',
            status: data.status as 'NONE' | 'PENDING' | 'REJECTED',
            rejectionReason: data.rejectionReason,
          });
          return;
        }

        try {
          await apiFetch('/api/instructors/me');
          if (active) setState({ kind: 'ready-verified-has-listing' });
        } catch {
          if (active) setState({ kind: 'ready-verified-no-listing' });
        }
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'ready', status: 'NONE' });
      });

    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  if (state.kind === 'ready-verified-has-listing') {
    return null;
  }

  if (state.kind === 'ready-verified-no-listing') {
    return (
      <Card className="surface-card border-brand-500/30 bg-brand-100 dark:bg-brand-900">
        <CardContent className="grid gap-4 p-8">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{tcl('eyebrow')}</p>
          <p className="text-h4 text-foreground">{tcl('title')}</p>
          <p className="max-w-2xl text-body text-muted-foreground">{tcl('body')}</p>
          <div>
            <Button asChild>
              <Link href="/instructors/new">{tcl('cta')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (state.status === 'REJECTED') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="grid gap-2 p-8">
          <p className="text-eyebrow text-destructive">{t('rejectedEyebrow')}</p>
          <p className="text-h4 text-foreground">{t('rejectedTitle')}</p>
          <p className="max-w-2xl text-body text-muted-foreground">
            {state.rejectionReason ? state.rejectionReason : t('rejectedBody')}
          </p>
        </CardContent>
      </Card>
    );
  }

  // NONE | PENDING
  return (
    <Card className="surface-card border-brand-500/30 bg-brand-100 dark:bg-brand-900">
      <CardContent className="grid gap-3 p-8">
        <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('pendingEyebrow')}</p>
        <p className="text-h4 text-foreground">{t('pendingTitle')}</p>
        <p className="max-w-2xl text-body text-muted-foreground">{t('pendingBody')}</p>
        <p className="text-small text-muted-foreground">{td('emptyBody')}</p>
      </CardContent>
    </Card>
  );
}
