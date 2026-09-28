//
// The profile is intentionally a small decision surface: live identity,
// categories, rate, learner fee quote, booking mode, cancellation schedule,
// and platform safety expectations. Availability and booking remain in the
// adjacent BookingForm island so every mutation still uses the REST data
// plane.

'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useState } from 'react';
import { BookingPriceSummary } from '@/components/custom/booking-price-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { getPolicyForTier } from '@/lib/business/cancellation-policy';
import { InstructorItem } from '@/lib/contracts/instructors';

type Status = 'loading' | 'not-found' | 'error' | 'profile';

export function InstructorDetail({ instructorId }: { instructorId: string }) {
  const [status, setStatus] = useState<Status>('loading');
  const [instructor, setInstructor] = useState<InstructorItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const tr = useTranslations('instructorDetail');
  const tAffiliation = useTranslations('instructorAffiliation');
  const locale = useLocale();

  useEffect(() => {
    let active = true;
    setStatus('loading');
    setErrorMsg(null);
    apiFetch(`/api/instructors/${encodeURIComponent(instructorId)}`, {
      schema: InstructorItem,
    })
      .then((data) => {
        if (!active) return;
        setInstructor(data);
        setStatus('profile');
      })
      .catch((err: unknown) => {
        if (!active) return;
        const body = err instanceof Error ? err.cause : null;
        if (
          body &&
          typeof body === 'object' &&
          'errors' in body &&
          (body as { errors?: { id?: string } }).errors?.id === 'Not found'
        ) {
          setStatus('not-found');
          return;
        }
        setStatus('error');
        setErrorMsg(tr('loadError'));
      });
    return () => {
      active = false;
    };
  }, [instructorId, tr]);

  if (status === 'loading') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="flex flex-col gap-3 p-6">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </CardContent>
      </Card>
    );
  }

  if (status === 'not-found') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
          <p className="font-display text-h3 tracking-tight text-foreground">
            {tr('notFoundTitle')}
          </p>
          <p className="max-w-sm text-small text-muted-foreground">{tr('notFoundBody')}</p>
          <Button asChild variant="outline" size="sm" className="mt-1">
            <Link href="/instructors">{tr('backDirectory')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (status === 'error' || !instructor) {
    return (
      <Card className="border-destructive/40 bg-destructive/5">
        <CardContent className="p-6">
          <p className="text-small font-medium text-destructive">
            {errorMsg ?? tr('fallbackError')}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card instructor-detail-card min-w-0 overflow-hidden border-brand-500/25 bg-card shadow-md">
      <CardContent className="grid min-w-0 gap-7 p-6 sm:p-8 md:grid-cols-[180px_minmax(0,1fr)] md:gap-9">
        <div className="instructor-detail-photo flex min-w-0 items-start justify-center">
          <Image
            src={instructor.photoUrl}
            alt={tr('portraitAlt', { name: instructor.name })}
            width={180}
            height={180}
            unoptimized
            className="size-[180px] max-w-full rounded-xl border border-brand-500/25 bg-brand-100 object-cover shadow-sm dark:bg-brand-900"
          />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <div className="min-w-0">
            <p className="text-eyebrow">{tr('profileEyebrow')}</p>
            <h1 className="mt-1 break-words font-display text-h1 leading-tight tracking-tight text-foreground">
              {instructor.name}
            </h1>
            <p className="mt-1 text-body text-muted-foreground">
              {tr('locatedIn', { city: instructor.city })}
            </p>
            {instructor.affiliation ? (
              <p className="mt-2 text-body text-muted-foreground">
                <Link
                  href={`/schools/${instructor.affiliation.slug}`}
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {tAffiliation('belongsTo', { name: instructor.affiliation.name })}
                </Link>
              </p>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap gap-2">
            {instructor.categories.map((category) => (
              <Badge
                key={category}
                variant="secondary"
                className="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
              >
                {tr(`category.${category}`)}
              </Badge>
            ))}
          </div>

          <dl className="grid min-w-0 gap-3 rounded-xl border border-border bg-muted p-4 sm:grid-cols-2">
            <Fact label={tr('facts.city')}>{instructor.city}</Fact>
            <Fact label={tr('facts.serviceArea')}>{instructor.serviceArea}</Fact>
            <Fact label={tr('facts.language')}>
              {instructor.languages.map((language) => tr(`language.${language}`)).join(' · ')}
            </Fact>
            <Fact label={tr('facts.verification')}>
              <span className="inline-flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-brand-500" aria-hidden />
                {tr(`verification.${instructor.verificationStatus}`)}
              </span>
            </Fact>
            <Fact label={tr('facts.reviews')}>
              {instructor.reviewSummary.averageRating === null
                ? tr('reviews.none')
                : tr('reviews.summary', {
                    count: instructor.reviewSummary.count,
                    average: formatNumber(instructor.reviewSummary.averageRating, locale),
                  })}
            </Fact>
            <Fact label={tr('facts.availability')}>
              {instructor.nextSlotAt
                ? formatSlotDate(instructor.nextSlotAt, locale)
                : tr('availability.none')}
            </Fact>
            <div className="min-w-0 sm:col-span-2">
              <dt className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {tr('hourlyRate')}
              </dt>
              <dd className="mt-1 break-words font-display text-h2 font-semibold tracking-tight text-foreground">
                {formatSek(instructor.hourlyRateSek, locale, tr('rateSuffix'))}
              </dd>
            </div>
          </dl>

          <BookingPriceSummary instructorId={instructor.id} />

          <p className="min-w-0 break-words text-body text-muted-foreground">{instructor.bio}</p>

          <BookingModeSection bookingMode={instructor.bookingMode} />
          <CancellationPolicySection tier={instructor.cancellationPolicyTier} />
          <SafetyExpectations />
        </div>
      </CardContent>
    </Card>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <dt className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </dt>
      <dd className="min-w-0 break-words text-small font-medium text-foreground">{children}</dd>
    </div>
  );
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatSek(value: number, locale: string, suffix: string): string {
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(value)} ${suffix}`;
}

function formatSlotDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso));
}

function BookingModeSection({ bookingMode }: { bookingMode: InstructorItem['bookingMode'] }) {
  const tr = useTranslations('instructorDetail');
  const mode = bookingMode === 'request' ? 'request' : 'instant';
  return (
    <section className="grid min-w-0 gap-2 rounded-xl border border-border bg-muted p-4">
      <p className="text-eyebrow text-muted-foreground">{tr('bookingModeEyebrow')}</p>
      <p className="font-display text-h4 font-semibold tracking-tight text-foreground">
        {tr(`bookingMode.${mode}.title`)}
      </p>
      <p className="text-small text-muted-foreground">{tr(`bookingMode.${mode}.body`)}</p>
    </section>
  );
}

function CancellationPolicySection({ tier }: { tier: InstructorItem['cancellationPolicyTier'] }) {
  const tr = useTranslations('cancellationPolicy');
  const tierKey = tier ?? 'flexible';
  const policy = getPolicyForTier(tierKey);
  return (
    <section className="grid min-w-0 gap-3 rounded-xl border border-border bg-muted p-4">
      <div>
        <p className="text-eyebrow text-muted-foreground">{tr('sectionEyebrow')}</p>
        <p className="mt-1 font-display text-h4 font-semibold tracking-tight text-foreground">
          {tr(`${tierKey}.name`)}
        </p>
        <p className="mt-1 text-small text-muted-foreground">{tr(`${tierKey}.summary`)}</p>
      </div>
      <ul className="grid gap-2 text-small text-foreground">
        <li className="flex items-start gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
          <span>{tr(`${tierKey}.fullRefundBefore`)}</span>
        </li>
        {policy.partialFeePercent > 0 ? (
          <li className="flex items-start gap-2">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
            <span>{tr(`${tierKey}.partialBetween`)}</span>
          </li>
        ) : null}
        <li className="flex items-start gap-2">
          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
          <span>{tr(`${tierKey}.noRefundAfter`)}</span>
        </li>
      </ul>
    </section>
  );
}

function SafetyExpectations() {
  const tr = useTranslations('instructorDetail');
  return (
    <section className="grid min-w-0 gap-3 rounded-xl border border-brand-500/25 bg-brand-100 p-4 dark:bg-brand-900">
      <div>
        <p className="text-eyebrow text-brand-700 dark:text-brand-300">{tr('safetyEyebrow')}</p>
        <p className="mt-1 font-display text-h4 font-semibold tracking-tight text-foreground">
          {tr('safetyTitle')}
        </p>
        <p className="mt-1 text-small text-muted-foreground">{tr('safetyBody')}</p>
      </div>
      <ul className="grid gap-2 text-small text-foreground">
        <li>{tr('safetyItems.credentials')}</li>
        <li>{tr('safetyItems.insurance')}</li>
        <li>{tr('safetyItems.checkBeforeBooking')}</li>
      </ul>
    </section>
  );
}
