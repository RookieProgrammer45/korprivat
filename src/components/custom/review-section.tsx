// instructor detail page. Owns BOTH the list (GET) and the form (POST) so no
// DB read lands in the surrounding Server Component (which would cross the
// Server-Component ↔ route-handler boundary and break the build per the
// `nextjs-data-plane` skill).
//
// Mirrors the patterns in <BookingForm>: `useForm` + `zodResolver`, optimistic
// prepend on submit, `router.refresh()` after a 201 so the surrounding Server
// Component re-renders and confirms the row survived an RSC round-trip (the
// brief's "after reload" acceptance criterion), and a full
// loading/empty/error triad. Server-side validation messages stay English
// (the shared `ReviewCreate` zod schema carries English copy); the
// `reviewForm.validation` catalogue translations surface via the
// `applyServerErrors` 400 path when the server rejects a bad payload.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { BookingRead } from '@/lib/contracts/bookings';
import { ReviewCreate, ReviewItem, ReviewList } from '@/lib/contracts/reviews';
import { applyServerErrors } from '@/lib/forms';

type ListState =
  | { kind: 'loading' }
  | { kind: 'ready'; items: ReviewList['items'] }
  | { kind: 'empty' }
  | { kind: 'error' };

const RATING_VALUES = [1, 2, 3, 4, 5] as const;

type ReviewContext =
  | { kind: 'loading' }
  | { kind: 'eligible' }
  | { kind: 'not-eligible' }
  | { kind: 'already-reviewed' }
  | { kind: 'error' };

export function ReviewSection({
  instructorId,
  reviewBookingId,
}: {
  instructorId: string;
  reviewBookingId?: string | null;
}) {
  const router = useRouter();
  const t = useTranslations('reviewForm');

  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [reviewContext, setReviewContext] = useState<ReviewContext>(
    reviewBookingId ? { kind: 'loading' } : { kind: 'not-eligible' },
  );

  async function refetch(): Promise<void> {
    setList({ kind: 'loading' });
    try {
      const data = await apiFetch(`/api/instructors/${encodeURIComponent(instructorId)}/reviews`, {
        schema: ReviewList,
      });
      if (data.items.length === 0) {
        setList({ kind: 'empty' });
      } else {
        setList({ kind: 'ready', items: data.items });
      }
    } catch {
      setList({ kind: 'error' });
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await apiFetch(
          `/api/instructors/${encodeURIComponent(instructorId)}/reviews`,
          { schema: ReviewList },
        );
        if (!active) return;
        if (data.items.length === 0) {
          setList({ kind: 'empty' });
        } else {
          setList({ kind: 'ready', items: data.items });
        }
      } catch {
        if (!active) return;
        setList({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
    };
  }, [instructorId]);

  useEffect(() => {
    if (!reviewBookingId) {
      setReviewContext({ kind: 'not-eligible' });
      return;
    }
    let active = true;
    setReviewContext({ kind: 'loading' });
    Promise.all([
      apiFetch(`/api/bookings/${encodeURIComponent(reviewBookingId)}`, { schema: BookingRead }),
      apiFetch(
        `/api/instructors/${encodeURIComponent(instructorId)}/reviews?bookingId=${encodeURIComponent(reviewBookingId)}`,
        { schema: ReviewList },
      ),
    ])
      .then(([, reviewData]) => {
        if (!active) return;
        const status = reviewData.eligibility?.status;
        setReviewContext(
          status === 'eligible'
            ? { kind: 'eligible' }
            : status === 'already_reviewed'
              ? { kind: 'already-reviewed' }
              : { kind: 'not-eligible' },
        );
      })
      .catch(() => {
        if (active) setReviewContext({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, [instructorId, reviewBookingId]);

  const form = useForm<ReviewCreate>({
    // Pass a localised `errorMap` so zod's English validation copy is
    // translated into the active locale before it reaches FormMessage —
    // matches the brief's "Inline Swedish validation" requirement while
    // keeping the shared `ReviewCreate` schema untouched.
    resolver: zodResolver(ReviewCreate, {
      // `path` and `async` satisfy v3 ParseParams; `errorMap` provides
      // localised validation messages.
      path: [],
      async: false,
      errorMap: makeErrorMap(t),
    }),
    defaultValues: {
      instructorId,
      bookingId: reviewBookingId ?? '',
      reviewerName: '',
      rating: 5,
      comment: '',
    },
  });

  useEffect(() => {
    form.setValue('instructorId', instructorId);
    form.setValue('bookingId', reviewBookingId ?? '');
  }, [form, instructorId, reviewBookingId]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await apiFetch(
        `/api/instructors/${encodeURIComponent(instructorId)}/reviews`,
        {
          method: 'POST',
          body: JSON.stringify(values),
          schema: ReviewItem,
        },
      );
      // Optimistic prepend — matches the GET `orderBy: createdAt: 'desc'`
      // so the new card appears alongside earlier ones without a refetch.
      setList((prev) => ({
        kind: 'ready',
        items: [created, ...(prev.kind === 'ready' ? prev.items : [])],
      }));
      form.reset({
        instructorId,
        bookingId: reviewBookingId ?? '',
        reviewerName: '',
        rating: 5,
        comment: '',
      });
      setReviewContext({ kind: 'already-reviewed' });
      toast.success(t('submitSuccess'));
      router.refresh();
    } catch (err) {
      const localized = localizeReviewErrors(err instanceof Error ? err.cause : null, t);
      const applied =
        err instanceof Error ? applyServerErrors(localized.body, form.setError) : false;
      if (localized.general) {
        toast.error(localized.general);
        return;
      }
      if (!applied) {
        toast.error(t('submitError'));
      }
    }
  });

  return (
    <Card className="surface-panel border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6">
        {reviewContext.kind === 'eligible' ? (
          <Form {...form}>
            <form onSubmit={onSubmit} className="grid gap-4" noValidate>
              <FormField
                control={form.control}
                name="reviewerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('labels.nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="name"
                        placeholder={t('placeholders.namePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem className="space-y-2">
                    <FormLabel>{t('labels.ratingLabel')}</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={String(field.value ?? 5)}
                        onValueChange={(v) => field.onChange(Number(v))}
                        onBlur={field.onBlur}
                        aria-label={t('labels.ratingAriaLabel')}
                        className="grid gap-2 sm:grid-cols-5"
                      >
                        {RATING_VALUES.map((value) => (
                          <RatingOption key={value} value={value} t={t} />
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="comment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('labels.commentLabel')}</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={4}
                        placeholder={t('placeholders.commentPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-sm">
                {form.formState.isSubmitting ? t('submitting') : t('submit')}
              </Button>
            </form>
          </Form>
        ) : (
          <ReviewContextNotice state={reviewContext} />
        )}
        <ReviewListBlock state={list} onRetry={refetch} />
      </CardContent>
    </Card>
  );
}

function ReviewContextNotice({ state }: { state: ReviewContext }) {
  const t = useTranslations('reviewForm.context');
  if (state.kind === 'loading') return <Skeleton className="h-24 w-full" />;
  const key =
    state.kind === 'already-reviewed'
      ? 'alreadyReviewed'
      : state.kind === 'error'
        ? 'error'
        : 'notEligible';
  return (
    <div
      className="rounded-lg border border-border bg-muted p-4"
      role={state.kind === 'error' ? 'alert' : 'status'}
    >
      <p className="text-small font-medium text-foreground">{t(`${key}Title`)}</p>
      <p className="mt-1 text-small text-muted-foreground">{t(`${key}Body`)}</p>
    </div>
  );
}

function RatingOption({
  value,
  t,
}: {
  value: number;
  t: ReturnType<typeof useTranslations<'reviewForm'>>;
}) {
  const id = `rating-${value}`;
  return (
    <div className="group relative flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-small font-medium transition-colors hover:border-brand-500 hover:bg-brand-100 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-100 dark:hover:bg-brand-900 dark:has-[[data-state=checked]]:bg-brand-900">
      <RadioGroupItem
        id={id}
        value={String(value)}
        aria-label={t('ratingOption', { rating: value })}
        className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>span]:hidden"
      />
      <span aria-hidden="true" className="pointer-events-none min-w-0 text-foreground">
        {t('ratingOption', { rating: value })}
      </span>
    </div>
  );
}

function ReviewListBlock({ state, onRetry }: { state: ListState; onRetry: () => void }) {
  const tList = useTranslations('reviewForm.list');

  if (state.kind === 'loading') {
    return (
      <div className="grid gap-2">
        <p className="text-eyebrow">{tList('heading')}</p>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }
  if (state.kind === 'error') {
    return (
      <div className="grid gap-3">
        <p className="text-eyebrow">{tList('heading')}</p>
        <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-brand-700 dark:text-brand-300">{tList('loadError')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="border-brand-500/40"
            >
              {tList('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (state.kind === 'empty') {
    return (
      <div className="grid gap-3">
        <p className="text-eyebrow">{tList('heading')}</p>
        <Card className="border-border bg-muted">
          <CardContent className="p-4">
            <p className="text-small font-medium text-foreground">{tList('emptyTitle')}</p>
            <p className="text-small text-muted-foreground">{tList('emptyBody')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="text-eyebrow">{tList('heading')}</p>
      <div className="grid gap-3">
        {state.items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>
    </div>
  );
}

function ReviewCard({ review }: { review: ReviewItem }) {
  const tList = useTranslations('reviewForm.list');
  return (
    <Card className="border-border bg-background">
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-small font-semibold text-foreground">{review.reviewerName}</p>
          <Badge
            variant="secondary"
            className="bg-brand-100 text-brand-700 hover:bg-brand-200 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-800"
          >
            {tList('ratingValue', { rating: review.rating })}
          </Badge>
        </div>
        <p className="text-body text-foreground">{review.comment}</p>
      </CardContent>
    </Card>
  );
}

// zod errorMap — keys off the issue `code` (which is stable across zod
// versions) rather than sniffing the default `message` text. Falls back
// to the original message when the (field, code) pair is unmapped. The
// `ZodIssueOptionalMessage` shape from zod v3 makes `message` optional so
// we type it that way here too.
function makeErrorMap<T extends ReturnType<typeof useTranslations<'reviewForm'>>>(t: T) {
  return (issue: {
    code: string;
    path: (string | number)[];
    message?: string;
  }): { message: string } => {
    const fieldRaw = issue.path[0];
    if (typeof fieldRaw !== 'string') return { message: issue.message ?? '' };
    const field = fieldRaw as keyof ReviewCreate;
    if (field === 'reviewerName') {
      if (issue.code === 'too_big') return { message: t('validation.nameTooLong') };
      if (issue.code === 'too_small') return { message: t('validation.nameRequired') };
    }
    if (field === 'comment') {
      if (issue.code === 'too_small') return { message: t('validation.commentRequired') };
    }
    if (field === 'rating') {
      // The schema is `.int().min(1).max(5)`; missing / wrong values surface
      // as `invalid_type`, `too_small`, or `too_big`.
      if (issue.code === 'invalid_type' || issue.code === 'too_small' || issue.code === 'too_big') {
        return { message: t('validation.ratingRequired') };
      }
    }
    return { message: issue.message ?? '' };
  };
}

function localizeReviewErrors(
  body: unknown,
  t: ReturnType<typeof useTranslations<'reviewForm'>>,
): { body: { errors: Record<string, string> }; general?: string } {
  const errors: Record<string, string> = {};
  let general: string | undefined;
  for (const [field, message] of Object.entries(getServerErrors(body))) {
    if (field === 'reviewerName') {
      errors[field] = message.toLowerCase().includes('long')
        ? t('validation.nameTooLong')
        : t('validation.nameRequired');
    } else if (field === 'comment') {
      errors[field] = t('validation.commentRequired');
    } else if (field === 'rating') {
      errors[field] = t('validation.ratingRequired');
    } else if (field === 'bookingId') {
      general = t('validation.bookingUnavailable');
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
