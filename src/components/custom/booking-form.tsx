// locale from the `bookingForm` namespace; the live state machine stays
// unchanged (server-loaded instructor + slot list, slot picker, Stripe
// redirect).

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BookingPriceSummary } from '@/components/custom/booking-price-summary';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { useSession } from '@/lib/auth-client';
import type { CancellationTier } from '@/lib/business/cancellation-policy';
import {
  clearBookingDraft,
  persistBookingDraft,
  readBookingDraft,
} from '@/lib/booking-form-draft';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import {
  BookingCreate,
  BookingCreated,
  BookingPaymentLinkResponse,
  BookingPaymentPollResponse,
  BookingRead,
} from '@/lib/contracts/bookings';
import { InstructorItem } from '@/lib/contracts/instructors';
import { RebookSuggestResponse } from '@/lib/contracts/saved-payment-methods';
import { applyServerErrors } from '@/lib/forms';
import { type LearnerVerificationState, stateToRoute } from '@/lib/verification/state';
import { cn } from '@/lib/utils';

type FormValues = BookingCreate;

const POLL_INTERVAL_MS = 1500;
const POLL_MAX_ATTEMPTS = 10;

type SlotState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: AvailabilitySlotList['items'] }
  | { kind: 'empty' }
  | { kind: 'error' };

export function BookingForm({
  instructorId,
  bookingId: externalBookingId,
  bookingToken,
  rebookBookingId,
}: {
  instructorId: string;
  bookingId: string | null;
  bookingToken?: string;
  // The bookingId parsed from the `?rebook=<id>` search param on the
  // instructor profile page. When that's non-null AND the user is signed
  // in, the form the user sees on `/instructors/[id]?rebook=<id>` is
  // pre-filled from `/api/bookings/me/suggest-rebook?instructorId=…`.
  // We carry only the id (not the row) — the server keeps ownership of
  // the read so a forger can't spoof another user's last booking.
  rebookBookingId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending: sessionPending } = useSession();
  const t = useTranslations('bookingForm');
  const tDetail = useTranslations('instructorDetail');
  const locale = useLocale();

  const [instructor, setInstructor] = useState<InstructorItem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);
  const [sentRate, setSentRate] = useState<number | null>(null);
  const [sentInstructorName, setSentInstructorName] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRead | null>(null);
  const [bookingReadLoaded, setBookingReadLoaded] = useState(false);
  const [bookingReadError, setBookingReadError] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPollError, setPaymentPollError] = useState(false);
  const [_paymentPollRetryNonce, setPaymentPollRetryNonce] = useState(0);
  const [slots, setSlots] = useState<SlotState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch(`/api/instructors/${encodeURIComponent(instructorId)}`, {
      schema: InstructorItem,
    })
      .then((data) => {
        if (!active) return;
        setInstructor(data);
        setLoadError(null);
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
          setLoadError(t('instructorUnavailable'));
          return;
        }
        setLoadError(t('loadError'));
      });
    return () => {
      active = false;
    };
  }, [instructorId, t]);

  // `refetchSlots` is captured by the dependency-free effect below; it
  // also gets invoked manually after a 409 from /api/bookings so the
  // picker removes a slot the learner lost the race for.
  async function refetchSlots(): Promise<void> {
    setSlots({ kind: 'loading' });
    try {
      const data = await apiFetch(
        `/api/instructors/${encodeURIComponent(instructorId)}/availability`,
        { schema: AvailabilitySlotList },
      );
      if (data.items.length === 0) {
        setSlots({ kind: 'empty' });
      } else {
        setSlots({ kind: 'ready', items: data.items });
      }
    } catch {
      setSlots({ kind: 'error' });
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch(
          `/api/instructors/${encodeURIComponent(instructorId)}/availability`,
          { schema: AvailabilitySlotList },
        );
        if (!active) return;
        if (data.items.length === 0) {
          setSlots({ kind: 'empty' });
        } else {
          setSlots({ kind: 'ready', items: data.items });
        }
      } catch {
        if (!active) return;
        setSlots({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [instructorId]);

  useEffect(() => {
    if (!externalBookingId) {
      setBooking(null);
      setBookingReadLoaded(false);
      setBookingReadError(false);
      setPaymentPollError(false);
      return;
    }
    let active = true;
    setBookingReadLoaded(false);
    setBookingReadError(false);
    setPaymentPollError(false);
    apiFetch(`/api/bookings/${encodeURIComponent(externalBookingId)}`, {
      schema: BookingRead,
      headers: accessHeaders(bookingToken),
    })
      .then((data) => {
        if (!active) return;
        setBooking(data);
        setBookingReadLoaded(true);
      })
      .catch(() => {
        if (!active) return;
        setBookingReadError(true);
        setBookingReadLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [bookingToken, externalBookingId]);

  useEffect(() => {
    if (!booking || booking.paymentStatus !== 'pending' || !externalBookingId) return;
    let active = true;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (!active) return;
      attempt += 1;
      try {
        const result = await apiFetch(
          `/api/bookings/${encodeURIComponent(externalBookingId)}/payment-poll`,
          { schema: BookingPaymentPollResponse, headers: accessHeaders(bookingToken) },
        );
        if (!active) return;
        if (result.verified && result.paymentStatus !== 'pending') {
          const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(externalBookingId)}`, {
            schema: BookingRead,
            headers: accessHeaders(bookingToken),
          });
          if (active) {
            setPaymentPollError(false);
            setBooking(fresh);
          }
          return;
        }
      } catch {
        // Transient — the next attempt will retry. Silence.
      }
      if (!active) return;
      if (attempt < POLL_MAX_ATTEMPTS) {
        timer = setTimeout(tick, POLL_INTERVAL_MS);
      } else if (active) {
        setPaymentPollError(true);
      }
    };

    timer = setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [booking, bookingToken, externalBookingId]);

  const categoryOptions = useMemo(() => instructor?.categories ?? [], [instructor]);

  const form = useForm<FormValues>({
    resolver: zodResolver(BookingCreate, {
      path: [],
      async: false,
      errorMap: makeErrorMap(t),
    }),
    defaultValues: {
      studentName: '',
      studentEmail: '',
      studentPhone: '',
      slotId: '',
      instructorId,
      locale: locale === 'en' ? 'en' : 'sv',
    },
  });

  useEffect(() => {
    form.setValue('instructorId', instructorId);
  }, [form, instructorId]);

  // Restore draft after login/signup bounce so the learner does not retype.
  useEffect(() => {
    const draft = readBookingDraft(instructorId);
    if (!draft) return;
    if (draft.studentName) form.setValue('studentName', draft.studentName, { shouldDirty: true });
    if (draft.studentEmail) form.setValue('studentEmail', draft.studentEmail, { shouldDirty: true });
    if (draft.studentPhone) form.setValue('studentPhone', draft.studentPhone, { shouldDirty: true });
    if (draft.category) {
      form.setValue('category', draft.category as FormValues['category'], { shouldDirty: true });
    }
    if (draft.slotId) form.setValue('slotId', draft.slotId, { shouldDirty: true });
  }, [form, instructorId]);

  useEffect(() => {
    const first = categoryOptions[0];
    if (instructor && first && !form.formState.dirtyFields.category) {
      form.setValue('category', first as FormValues['category']);
    }
  }, [instructor, categoryOptions, form]);

  // Rebook prefill: when the page is loaded with `?rebook=<bookingId>`,
  // fetch `/api/bookings/me/suggest-rebook?instructorId=...` and pre-fill
  // `studentName` / `studentEmail` / `studentPhone` / `category`. We keep
  // the request scope to a single instructor (the page is on
  // `/instructors/[id]`) so we don't need a (bookingId, instructorId)
  // payload — just the `instructorId` is enough.
  //
  // The prefill is best-effort: the route returns `null` when the user
  // has no prior booking with this instructor, which is silently
  // consumed. The user can still type fresh values into the form — the
  // rebook affordance is purely a UX shortcut.
  useEffect(() => {
    if (!rebookBookingId) return;
    let active = true;
    apiFetch(`/api/bookings/me/suggest-rebook?instructorId=${encodeURIComponent(instructorId)}`, {
      schema: RebookSuggestResponse,
    })
      .then((data) => {
        if (!active) return;
        const suggested = data.suggested;
        if (!suggested) return;
        const next: Partial<FormValues> = {
          studentName: suggested.studentName,
          studentEmail: suggested.studentEmail,
          studentPhone: suggested.studentPhone,
        };
        // Only override category when the form has not been touched — the
        // rebook prefill is a hint, not a hard write.
        const currentCategory = form.getValues('category');
        if (!currentCategory && suggested.category) {
          next.category = suggested.category as FormValues['category'];
        }
        for (const [key, value] of Object.entries(next)) {
          if (value) {
            form.setValue(key as keyof FormValues, value as never, {
              shouldDirty: false,
            });
          }
        }
      })
      .catch(() => {
        // Failure-insensitive — keep the original form values.
      });
    return () => {
      active = false;
    };
  }, [rebookBookingId, instructorId, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!values.slotId) {
      form.setError('slotId', { type: 'server', message: t('slots.noSlotsAvailable') });
      return;
    }

    if (sessionPending) return;
    if (!session?.user) {
      persistBookingDraft(instructorId, {
        studentName: values.studentName,
        studentEmail: values.studentEmail,
        studentPhone: values.studentPhone,
        category: values.category ?? '',
        slotId: values.slotId,
      });
      const next =
        typeof window !== 'undefined'
          ? `${window.location.pathname}${window.location.search}`
          : pathname;
      router.push(`/login?next=${encodeURIComponent(next)}`);
      return;
    }

    setEligibilityError(null);

    try {
      // Always POST with the matching `mode` so the route does not 400
      // when the instructor's published mode is `request`. Mirrors the
      // server-side branch on `data.mode === 'request'`.
      const submittedMode: 'instant' | 'request' =
        instructor?.bookingMode === 'request' ? 'request' : 'instant';
      const created = await apiFetch('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          mode: submittedMode,
          locale: locale === 'en' ? 'en' : 'sv',
        }),
        schema: BookingCreated,
      });
      clearBookingDraft(instructorId);
      setSentRate(created.hourlyRateSek);
      setSentInstructorName(instructor?.name ?? null);
      router.replace(
        `/bookings/${encodeURIComponent(created.id)}?token=${encodeURIComponent(created.learnerAccessToken)}`,
      );
    } catch (err) {
      const body = err instanceof Error ? err.cause : null;
      if (
        body &&
        typeof body === 'object' &&
        'error' in body &&
        (body as { error?: string }).error === 'learner_not_eligible'
      ) {
        const state = (body as { state?: string }).state;
        const redirectTo =
          typeof (body as { redirectTo?: string }).redirectTo === 'string'
            ? (body as { redirectTo: string }).redirectTo
            : state && typeof state === 'string'
              ? stateToRoute(state as LearnerVerificationState)
              : '/onboarding/learner/verify';
        if (state === 'BLOCKED_UNDERAGE' || state === 'SUSPENDED') {
          setEligibilityError(t('learnerNotEligible'));
          return;
        }
        setEligibilityError(t('learnerNeedsVerification'));
        router.push(redirectTo);
        return;
      }
      const slotError = getServerErrors(body).slotId;
      const localized = localizeBookingErrors(body, t);
      if (localized.general) {
        toast.error(localized.general);
        return;
      }
      const applied = err instanceof Error && applyServerErrors(localized.body, form.setError);
      if (!applied) {
        toast.error(t('submitError'));
        return;
      }
      // Slot-related errors → refetch the slot list so the picker reflects
      // the loss (a "Slot no longer available" 409 means another learner
      // booked it while this one was loading the page).
      if (slotError) {
        toast.error(t('slots.slotTaken'));
        await refetchSlots();
      }
    }
  });

  const startPayment = async (id: string) => {
    setPaymentLoading(true);
    try {
      const result = await apiFetch('/api/checkout', {
        method: 'POST',
        body: JSON.stringify({
          bookingId: id,
          ...(bookingToken ? { token: bookingToken } : {}),
        }),
        headers: accessHeaders(bookingToken),
        schema: BookingPaymentLinkResponse,
      });
      if (!result.url) {
        const fresh = await apiFetch(`/api/bookings/${encodeURIComponent(id)}`, {
          schema: BookingRead,
          headers: accessHeaders(bookingToken),
        });
        setBooking(fresh);
        return;
      }
      window.location.assign(result.url);
    } catch (err) {
      const body = err instanceof Error ? err.cause : null;
      const paymentsError =
        body &&
        typeof body === 'object' &&
        'errors' in body &&
        (body as { errors?: { payments?: string } }).errors?.payments;
      if (paymentsError === 'not_enabled') {
        toast.error(t('paymentNotEnabled'));
      } else if (paymentsError === 'not_onboarded') {
        toast.error(t('instructorNotOnboarded'));
      } else {
        toast.error(t('paymentFailed'));
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  if (loadError) {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="p-6">
          <p className="text-small font-medium text-destructive">{loadError}</p>
        </CardContent>
      </Card>
    );
  }

  const showSuccessCard = booking !== null || (externalBookingId === null && sentRate !== null);
  if (showSuccessCard) {
    const liveRate = booking?.hourlyRateSek ?? sentRate ?? 0;
    const liveInstructorName = booking
      ? (instructor?.name ?? sentInstructorName ?? t('rateFallback'))
      : (sentInstructorName ?? t('rateFallback'));
    const paymentStatus = booking?.paymentStatus ?? 'unpaid';
    const statusReady = booking === null ? true : bookingReadLoaded;
    // The success view branches on booking-mode for the awaiting-approval
    // and declined branches. A Request row at `awaiting_approval` shows a
    // dedicated card (no Pay CTA); a `declined` row swaps to a paired
    // "was declined" message.
    const isRequestMode = booking?.bookingMode === 'request';

    return (
      <Card className="surface-card min-w-0 border-brand-500/40 bg-card shadow-sm">
        <CardContent className="flex min-w-0 flex-col gap-4 p-6 sm:p-7">
          <p className="text-eyebrow">
            {isRequestMode ? t('bookingRequest.eyebrow') : t('successEyebrow')}
          </p>
          <p className="text-body text-foreground">
            {isRequestMode
              ? t('bookingRequest.body', { instructor: liveInstructorName })
              : t('successBody', { instructor: liveInstructorName })}
          </p>
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-4 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
            <span className="min-w-0 text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {t('rateLabel')}
            </span>
            <span className="font-display text-h3 font-semibold tracking-tight text-brand-700 dark:text-brand-300">
              {formatSek(liveRate, locale, t('rateSuffix'))}
            </span>
          </div>
          {liveRate > 0 ? (
            <BookingPriceSummary
              instructorId={instructorId}
              snapshot={
                booking &&
                booking.priceAmountSek !== null &&
                booking.serviceFeeSek !== null &&
                booking.grossChargedSek !== null
                  ? {
                      priceAmountSek: booking.priceAmountSek,
                      serviceFeeSek: booking.serviceFeeSek,
                      grossChargedSek: booking.grossChargedSek,
                    }
                  : null
              }
            />
          ) : null}
          {bookingReadError ? (
            <p className="text-small text-muted-foreground">{t('freshLoadFailure')}</p>
          ) : null}
          {statusReady && paymentStatus === 'paid' ? (
            <div className="booking-status-row flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <span className="min-w-0 text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t('paymentLabel')}
              </span>
              <Badge className="shrink-0 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20">
                {t('paidBadge')}
              </Badge>
            </div>
          ) : null}
          {statusReady && paymentStatus === 'held_escrow' ? (
            <div className="flex flex-col gap-2 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
              <div className="booking-status-row flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t('paymentLabel')}
                </span>
                <Badge className="shrink-0 bg-brand-200 text-brand-700 hover:bg-brand-200 dark:bg-brand-800 dark:text-brand-300">
                  {t('holdLabel')}
                </Badge>
              </div>
              <p className="text-small text-muted-foreground">{t('holdBody')}</p>
              {booking?.disputeStatus === 'open' ? (
                <p className="text-small font-medium text-brand-700 dark:text-brand-300">
                  {t('disputeOpen')}
                </p>
              ) : null}
            </div>
          ) : null}
          {statusReady && paymentStatus === 'released' ? (
            <div className="flex flex-col gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
              <p className="text-body text-muted-foreground">{t('releasedBody')}</p>
            </div>
          ) : null}
          {statusReady && paymentStatus === 'refunded' ? (
            <div className="flex flex-col gap-1 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
              <div className="booking-status-row flex min-w-0 flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {t('paymentLabel')}
                </span>
                <Badge className="shrink-0 bg-brand-200 text-brand-700 hover:bg-brand-200 dark:bg-brand-800 dark:text-brand-300">
                  {t('refundedBadge')}
                </Badge>
              </div>
              <p className="text-small text-muted-foreground">{t('refundedBody')}</p>
            </div>
          ) : null}
          {statusReady && paymentStatus === 'awaiting_approval' ? (
            <BookingRequestAwaitingCard />
          ) : null}
          {statusReady && paymentStatus === 'declined' ? (
            <BookingRequestDeclinedCard instructorName={liveInstructorName} />
          ) : null}
          {statusReady && paymentStatus === 'pending' && externalBookingId ? (
            <div className="grid gap-3 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
              <Button type="button" disabled variant="secondary" className="w-fit shadow-sm">
                {t('waitingPayment')}
              </Button>
              {paymentPollError ? (
                <div className="grid gap-2">
                  <p className="text-small font-medium text-foreground">
                    {t('paymentPollTimeoutTitle')}
                  </p>
                  <p className="text-small text-muted-foreground">{t('paymentPollTimeoutBody')}</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit"
                    onClick={() => {
                      setPaymentPollError(false);
                      setPaymentPollRetryNonce((current) => current + 1);
                    }}
                  >
                    {t('retryPaymentPoll')}
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
          {statusReady &&
          (paymentStatus === 'unpaid' || (paymentStatus === 'pending' && !externalBookingId)) &&
          externalBookingId ? (
            <Button
              type="button"
              disabled={paymentLoading || !statusReady}
              onClick={() => externalBookingId && startPayment(externalBookingId)}
              className="shadow-sm"
            >
              {paymentLoading ? t('openingCheckout') : t('payLesson')}
            </Button>
          ) : null}
          <Link
            href={`/instructors/${encodeURIComponent(instructorId)}`}
            className="text-small text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {t('slots.backToProfile')}
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="booking-form-card surface-panel min-w-0 border-border bg-card shadow-sm">
      <CardHeader className="min-w-0">
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription className="min-w-0 break-words">
          {instructor
            ? t('descriptionLoaded', {
                rate: formatSek(instructor.hourlyRateSek, locale, t('rateSuffix')),
                firstName: instructor.name.split(' ')[0] ?? '',
              })
            : t('descriptionEmpty')}
        </CardDescription>
      </CardHeader>
      <CardContent className="min-w-0">
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid min-w-0 gap-4" noValidate>
            {instructor ? (
              <div className="min-w-0 rounded-lg border border-brand-500/25 bg-brand-100 p-4 dark:bg-brand-900">
                <p className="text-small font-medium text-foreground">
                  {instructor.bookingMode === 'request'
                    ? tDetail('bookingMode.request.title')
                    : tDetail('bookingMode.instant.title')}
                </p>
                <p className="mt-1 text-small text-muted-foreground">
                  {instructor.bookingMode === 'request'
                    ? tDetail('bookingMode.request.body')
                    : tDetail('bookingMode.instant.body')}
                </p>
              </div>
            ) : null}
            {instructor ? <BookingPriceSummary instructorId={instructor.id} /> : null}
            <FormField
              control={form.control}
              name="studentName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('labels.yourName')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="name"
                      placeholder={t('placeholders.yourName')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="studentEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('labels.email')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder={t('placeholders.email')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="studentPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('labels.phone')}</FormLabel>
                    <FormControl>
                      <Input
                        type="tel"
                        autoComplete="tel"
                        placeholder={t('placeholders.phone')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('labels.category')}</FormLabel>
                    {categoryOptions.length > 0 ? (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t('labels.categoryPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categoryOptions.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {tDetail(`category.${cat}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Skeleton className="h-9 w-full" />
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid min-w-0 gap-2">
                <p className="text-small font-medium leading-none">{t('slots.pickPrompt')}</p>
                <FormField
                  control={form.control}
                  name="slotId"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <SlotPicker
                          state={slots}
                          value={field.value}
                          onChange={(slotId) => {
                            field.onChange(slotId);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <BookingPolicyScheduleInline
              tier={
                instructor?.cancellationPolicyTier === 'moderate' ||
                instructor?.cancellationPolicyTier === 'strict' ||
                instructor?.cancellationPolicyTier === 'flexible'
                  ? (instructor?.cancellationPolicyTier as CancellationTier)
                  : 'flexible'
              }
            />

            <Button
              type="submit"
              disabled={form.formState.isSubmitting || !instructor}
              className="shadow-sm"
            >
              {form.formState.isSubmitting
                ? instructor?.bookingMode === 'request'
                  ? t('submittingRequest')
                  : t('submittingInstant')
                : instructor?.bookingMode === 'request'
                  ? t('submitRequest')
                  : t('submitInstant')}
            </Button>
            {eligibilityError ? (
              <p className="text-small text-destructive" role="alert">
                {eligibilityError}
              </p>
            ) : null}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// SlotPicker — inline slot-button list, grouped by day. Defaults to the
// first open slot when the list arrives so a learner only clicks once.
function SlotPicker({
  state,
  value,
  onChange,
}: {
  state: SlotState;
  value: string;
  onChange: (slotId: string) => void;
}) {
  const t = useTranslations('bookingForm.slots');
  const tIn = useTranslations('instructorDetail.slots');
  const locale = useLocale();

  // Auto-select the first open slot the first time we transition to ready
  // with no prior selection. Keeps the form friction-free.
  const groups = useMemo(() => {
    if (state.kind !== 'ready') return [];
    const groups = new Map<string, AvailabilitySlotList['items']>();
    for (const slot of state.items.filter((s) => s.bookedAt === null)) {
      const dayKey = formatDayKey(slot.startsAt);
      const list = groups.get(dayKey) ?? [];
      groups.set(dayKey, [...list, slot]);
    }
    return [...groups.entries()].map(([dayKey, items]) => ({ dayKey, items }));
  }, [state]);

  useEffect(() => {
    if (state.kind !== 'ready') return;
    if (value) return;
    const first = state.items.find((s) => s.bookedAt === null);
    if (first) {
      onChange(first.id);
    }
  }, [state, value, onChange]);

  if (state.kind === 'loading') {
    return <Skeleton className="h-20 w-full rounded-md" />;
  }
  if (state.kind === 'error') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-brand-700 dark:text-brand-300">{tIn('loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="border-brand-500/40"
          >
            {tIn('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (state.kind === 'empty') {
    return (
      <Card className="border-border bg-muted">
        <CardContent className="p-4">
          <p className="text-small text-muted-foreground">{tIn('empty')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid min-w-0 gap-3 rounded-md border border-border bg-muted p-3">
      {groups.length === 0 ? (
        <p className="text-small text-muted-foreground">{t('noSlotsAvailable')}</p>
      ) : (
        groups.map(({ dayKey, items }) => (
          <div key={dayKey} className="grid min-w-0 gap-1.5">
            <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {groupLabel(dayKey, t, locale)}
            </p>
            <div className="flex flex-wrap gap-2">
              {items.map((slot) => {
                const isSelected = value === slot.id;
                return (
                  <button
                    type="button"
                    key={slot.id}
                    aria-pressed={isSelected}
                    onClick={() => onChange(slot.id)}
                    className={cn(
                      'rounded-md border px-3 py-1.5 text-small font-medium transition-colors',
                      isSelected
                        ? 'border-brand-500 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                        : 'border-border bg-card text-foreground hover:border-brand-500 hover:bg-muted',
                    )}
                  >
                    {formatSlotTime(slot.startsAt, locale)}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function formatDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Stockholm',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year ?? '0000'}-${values.month ?? '00'}-${values.day ?? '00'}`;
}

function groupLabel(
  dayKey: string,
  t: ReturnType<typeof useTranslations<'bookingForm.slots'>>,
  locale: string,
): string {
  try {
    const parts = dayKey.split('-');
    const y = Number(parts[0] ?? '0');
    const m = Number(parts[1] ?? '0');
    const d = Number(parts[2] ?? '0');
    if (![y, m, d].every(Number.isFinite)) {
      return dayKey;
    }
    const date = new Date(Date.UTC(y, m - 1, d, 12));
    const todayKey = formatDayKey(new Date().toISOString());
    const todayParts = todayKey.split('-').map(Number);
    const today = new Date(
      Date.UTC(todayParts[0] ?? y, (todayParts[1] ?? m) - 1, todayParts[2] ?? d, 12),
    );
    const diffDays = Math.round((date.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return t('groupToday');
    if (diffDays === 1) return t('groupTomorrow');
    if (diffDays > 1 && diffDays < 7) {
      return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/Stockholm',
      }).format(date);
    }
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      dateStyle: 'medium',
      timeZone: 'Europe/Stockholm',
    }).format(date);
  } catch {
    return dayKey;
  }
}

function formatSlotTime(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Stockholm',
    }).format(d);
  } catch {
    return iso;
  }
}

function accessHeaders(token: string | undefined): HeadersInit {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatSek(amount: number, locale: string, suffix: string): string {
  return `${new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB').format(amount)} ${suffix}`;
}

function makeErrorMap<T extends ReturnType<typeof useTranslations<'bookingForm'>>>(t: T) {
  return (issue: {
    code: string;
    path: (string | number)[];
    message?: string;
  }): { message: string } => {
    const field = issue.path[0];
    if (field === 'studentName') {
      if (issue.code === 'too_big') return { message: t('validation.nameTooLong') };
      if (issue.code === 'too_small') return { message: t('validation.nameRequired') };
    }
    if (
      field === 'studentEmail' &&
      (issue.code === 'invalid_string' || issue.code === 'invalid_type')
    ) {
      return { message: t('validation.emailInvalid') };
    }
    if (field === 'studentPhone') {
      if (issue.code === 'too_big') return { message: t('validation.phoneTooLong') };
      if (issue.code === 'too_small') return { message: t('validation.phoneRequired') };
    }
    if (field === 'category') return { message: t('validation.categoryRequired') };
    if (field === 'slotId' && issue.code === 'too_small') {
      return { message: t('validation.slotRequired') };
    }
    return { message: issue.message ?? '' };
  };
}

type LocalizedErrors = { body: { errors: Record<string, string> }; general?: string };

function localizeBookingErrors(
  body: unknown,
  t: ReturnType<typeof useTranslations<'bookingForm'>>,
): LocalizedErrors {
  const source = getServerErrors(body);
  const errors: Record<string, string> = {};
  let general: string | undefined;
  for (const [field, message] of Object.entries(source)) {
    const lower = message.toLowerCase();
    if (field === 'studentName') {
      errors[field] = lower.includes('long')
        ? t('validation.nameTooLong')
        : t('validation.nameRequired');
    } else if (field === 'studentEmail') {
      errors[field] = t('validation.emailInvalid');
    } else if (field === 'studentPhone') {
      errors[field] = lower.includes('long')
        ? t('validation.phoneTooLong')
        : t('validation.phoneRequired');
    } else if (field === 'category') {
      errors[field] = t('validation.categoryRequired');
    } else if (field === 'slotId') {
      errors[field] =
        lower.includes('no longer') || lower.includes('taken')
          ? t('slots.slotTaken')
          : t('validation.slotRequired');
    } else if (field === 'mode') {
      general = t('validation.bookingModeChanged');
    }
  }
  return { body: { errors }, general };
}

function getServerErrors(body: unknown): Record<string, string> {
  if (!body || typeof body !== 'object' || !('errors' in body)) return {};
  const errors = (body as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') return {};
  if ('fieldErrors' in errors) {
    const fieldErrors = (errors as { fieldErrors?: unknown }).fieldErrors;
    if (!fieldErrors || typeof fieldErrors !== 'object') return {};
    return Object.fromEntries(
      Object.entries(fieldErrors)
        .map(([field, value]) => [field, Array.isArray(value) ? value[0] : undefined])
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
    );
  }
  return Object.fromEntries(
    Object.entries(errors).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  );
}

// Tiny one-line refund summary the learner sees at the bottom of the form,
// above the (existing) submit button. Picks the matching schedule sentence
// from the bookingForm namespace — same set of strings the instructor-detail
// page uses for the full schedule, so the two views stay in lockstep. The
// cancel route reads its own snapshot at cancel time; this helper is
// purely presentational.
function BookingPolicyScheduleInline({ tier }: { tier: CancellationTier | null }) {
  const t = useTranslations('bookingForm');
  // Sanitise unknown strings (a future tier that the i18n files haven't
  // been updated for yet, or a missing field on a pre-tier row) so we
  // never crash the form.
  const safeTier: CancellationTier = tier === 'moderate' || tier === 'strict' ? tier : 'flexible';
  const summary =
    safeTier === 'flexible'
      ? t('policyScheduleFlexible')
      : safeTier === 'moderate'
        ? t('policyScheduleModerate')
        : t('policyScheduleStrict');
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-muted p-3" role="note">
      <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
        {t('policyEyebrow')}
      </p>
      <p className="text-small text-foreground">{summary}</p>
      <Link
        href="/faq"
        className="w-fit text-small font-medium text-brand-700 underline-offset-4 hover:underline dark:text-brand-300"
      >
        {t('policyLink')}
      </Link>
    </div>
  );
}

// Request-mode awaiting-approval card. Substituted into the success view
// in place of the "Pay for the lesson" CTA — the row is awaiting the
// instructor's decision and the learner has no payment action yet.
function BookingRequestAwaitingCard() {
  const t = useTranslations('bookingForm');
  return (
    <div className="flex flex-col gap-2 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
      <div className="booking-status-row flex min-w-0 flex-wrap items-center justify-between gap-2">
        <span className="min-w-0 text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {t('paymentLabel')}
        </span>
        <Badge className="shrink-0 bg-brand-200 text-brand-700 hover:bg-brand-200 dark:bg-brand-800 dark:text-brand-300">
          {t('bookingRequest.awaitingBadge')}
        </Badge>
      </div>
      <p className="text-small text-muted-foreground">{t('bookingRequest.awaitingBody')}</p>
    </div>
  );
}

// Request-mode declined card. Replaces the awaiting card when the row
// lands on `paymentStatus='declined'` — neutral, no Pay CTA.
function BookingRequestDeclinedCard({ instructorName }: { instructorName: string }) {
  const t = useTranslations('bookingForm');
  return (
    <div className="flex flex-col gap-1 rounded-md border border-brand-500/40 bg-brand-100 px-4 py-3 dark:bg-brand-900">
      <p className="text-body text-foreground">
        {t('bookingRequest.declinedBody', { instructor: instructorName })}
      </p>
    </div>
  );
}
