//
// Fetches the signed-in profile envelope from GET /api/profile, then renders:
//   1. a brand-tinted header card — avatar block (initial-letter fallback when
//      `image` is empty) + name/email + a soft role chip on the right
//   2. the role-correct upcoming-list (re-using the BookingList shape from
//      the dashboard), role-branched eyebrow + empty body copy
//
// Loading / empty / error states per the data-plane pattern (see
// student-dashboard / instructor-dashboard for the canonical example).

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import * as React from 'react';
import { ProfilePhotoEditor } from '@/components/custom/profile/profile-photo-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { Profile } from '@/lib/contracts/profile';

type ProfileResponse = ReturnType<typeof Profile.parse>;
type UpcomingItem = ProfileResponse['upcoming']['items'][number];

type LoadState = { kind: 'loading' } | { kind: 'ready'; data: ProfileResponse } | { kind: 'error' };

type PaymentStatus = UpcomingItem['paymentStatus'];

export function ProfilePage() {
  const t = useTranslations('profile');
  const [state, setState] = React.useState<LoadState>({ kind: 'loading' });

  const loadProfile = React.useCallback(() => {
    setState({ kind: 'loading' });
    apiFetch('/api/profile', { schema: Profile })
      .then((data) => {
        setState({ kind: 'ready', data });
      })
      .catch(() => {
        setState({ kind: 'error' });
      });
  }, []);

  React.useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    apiFetch('/api/profile', { schema: Profile })
      .then((data) => {
        if (!active) return;
        setState({ kind: 'ready', data });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-28 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-destructive">{t('loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="border-destructive/40"
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { user, role, upcoming, photo } = state.data;
  const eyebrow = role === 'INSTRUCTOR' ? 'instructorEyebrow' : 'studentEyebrow';

  return (
    <div className="grid gap-6">
      <ProfileHeader
        user={user}
        role={role}
        stagedImage={photo.status === 'STAGED' ? photo.imageUrl : null}
        onPhotoUploaded={loadProfile}
      />
      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow text-muted-foreground">{t(`upcoming.${eyebrow}`)}</p>
          <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('upcoming.count', { count: upcoming.items.length })}
          </p>
        </div>
        {upcoming.items.length === 0 ? (
          <Card className="surface-panel border-border bg-card">
            <CardContent className="flex flex-col gap-3 p-8">
              <p className="text-body font-medium text-foreground">{t('upcoming.emptyTitle')}</p>
              <p className="text-small text-muted-foreground">
                {t(
                  role === 'INSTRUCTOR'
                    ? 'upcoming.emptyBodyInstructor'
                    : 'upcoming.emptyBodyStudent',
                )}
              </p>
              <div className="mt-2">
                <Button asChild size="sm" variant="secondary">
                  <Link
                    href={
                      role === 'INSTRUCTOR' ? '/dashboard/instructor/availability' : '/instructors'
                    }
                  >
                    {t(
                      role === 'INSTRUCTOR'
                        ? 'upcoming.emptyCtaInstructor'
                        : 'upcoming.emptyCtaStudent',
                    )}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {upcoming.items.map((row) => (
              <li key={row.id}>
                <UpcomingCard row={row} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function ProfileHeader({
  user,
  role,
  stagedImage,
  onPhotoUploaded,
}: {
  user: { name: string; email: string; image: string | null };
  role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';
  stagedImage: string | null;
  onPhotoUploaded: () => void;
}) {
  const t = useTranslations('profile');
  const initial = user.name?.trim().charAt(0).toUpperCase() || '?';
  return (
    <Card className="surface-card overflow-hidden border-border bg-card shadow-sm">
      <CardContent className="relative grid gap-4 p-6 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <div className="relative">
          {user.image ? (
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-card">
              <Image
                src={user.image}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
                priority={false}
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-100 text-h2 font-bold text-brand-700 select-none dark:bg-brand-900 dark:text-brand-100">
              {initial}
            </div>
          )}
        </div>
        <div className="relative grid gap-1">
          <p className="text-small text-muted-foreground">{t('signedInAs', { name: user.name })}</p>
          <h2 className="font-display text-h3 font-semibold text-foreground">{user.name}</h2>
          <p className="text-small text-muted-foreground">{user.email}</p>
        </div>
        <div className="relative flex flex-col items-start gap-2 sm:items-end">
          <p className="text-eyebrow text-muted-foreground">{t('role.label')}</p>
          <Badge
            variant="outline"
            className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-200"
          >
            {t(
              role === 'INSTRUCTOR'
                ? 'role.instructor'
                : role === 'HANDLEDARE'
                  ? 'role.handledare'
                  : 'role.learner',
            )}
          </Badge>
          <ProfilePhotoEditor
            role={role}
            name={user.name}
            hasImage={Boolean(user.image)}
            stagedImage={stagedImage}
            onUploaded={onPhotoUploaded}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function UpcomingCard({ row }: { row: UpcomingItem }) {
  const t = useTranslations('profile');
  const locale = useLocale();
  return (
    <Card className="surface-card border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md">
      <CardContent className="grid gap-2 p-5 sm:grid-cols-[2fr_1fr_auto_auto] sm:items-center">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-base font-semibold text-foreground">
            {row.counterpartyName}
          </span>
          <span className="text-small text-muted-foreground">{row.category}</span>
        </div>
        <span className="text-small text-foreground">{formatDate(row.preferredAt, locale)}</span>
        <PaymentBadge status={row.paymentStatus} />
        <Button asChild variant="ghost" size="sm" className="justify-self-end">
          <Link href={`/bookings/${encodeURIComponent(row.id)}`}>{t('upcoming.open')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('profile');
  switch (status) {
    case 'unpaid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.unpaid')}
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="border-border bg-muted text-foreground">
          {t('paymentStatus.pending')}
        </Badge>
      );
    case 'paid':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.paid')}
        </Badge>
      );
    case 'held_escrow':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.heldEscrow')}
        </Badge>
      );
    case 'released':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.released')}
        </Badge>
      );
    case 'refunded':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.refunded')}
        </Badge>
      );
    case 'awaiting_approval':
      return (
        <Badge
          variant="outline"
          className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
        >
          {t('paymentStatus.awaitingApproval')}
        </Badge>
      );
    case 'declined':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.declined')}
        </Badge>
      );
    case 'cancelled_early':
    case 'cancelled_late':
    case 'cancelled_full_refund':
    case 'cancelled_partial':
      return (
        <Badge variant="outline" className="border-border bg-muted text-muted-foreground">
          {t('paymentStatus.cancelled')}
        </Badge>
      );
  }
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Europe/Stockholm',
    }).format(d);
  } catch {
    return iso;
  }
}
