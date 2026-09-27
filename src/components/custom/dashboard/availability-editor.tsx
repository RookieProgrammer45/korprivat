//
// Mounted only inside `/dashboard/instructor/availability`, this island
// drives the editor's three concerns:
//
//   1. Re-render the upcoming-slot list (open + booked) from
//      GET /api/instructor-availability on mount and after every change.
//   2. Bulk-create weekly slots: weekdays, start date, time-of-day, weeks
//      ahead, duration → POST /api/instructor-availability (mode: weekly).
//   3. Single-add: startsAt + endsAt + duration → POST (mode: single).
//   4. Per-row delete (DELETE) and edit (PATCH starts/ends) with the
//      booked-slot guard surfaced as a toast.
//
// The list is a `Card` per slot — booked slots render as a disabled
// surface so the operator sees the row but can't accidentally delete it.

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  localDateTimeToUtcIso,
  SWEDISH_TIMEZONE,
  utcToLocalDateTimeInput,
} from '@/lib/business/provider-timezone';
import { AvailabilitySlotList } from '@/lib/contracts/availability';
import { cn } from '@/lib/utils';

type Slot = AvailabilitySlotList['items'][number];

const WEEKDAYS: ReadonlyArray<number> = [0, 1, 2, 3, 4, 5, 6];

// Compute the next Monday in ISO date (YYYY-MM-DD). The weekly form
// defaults `startDate` to "the closest coming Monday at 0:00 local" so
// the operator's first slot lands on a real weekday.
function nextMondayIso(now: Date): string {
  const day = now.getDay(); // 0=Sun..6=Sat
  const offset = day === 1 ? 0 : (8 - day) % 7;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const y = target.getFullYear();
  const m = String(target.getMonth() + 1).padStart(2, '0');
  const d = String(target.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const WeeklyFormSchema = z.object({
  weekdays: z.array(z.number().int().min(0).max(6)).min(1, 'Pick at least one weekday'),
  startDate: z.string().min(1, 'Pick a start date'),
  timeOfDay: z.string().min(1, 'Pick a time'),
  weeksAhead: z.coerce.number().int().min(1).max(12),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
type WeeklyFormValues = z.infer<typeof WeeklyFormSchema>;

const SingleFormSchema = z.object({
  startsAt: z.string().min(1, 'Pick a start date and time'),
  endsAt: z.string().min(1, 'Pick an end date and time'),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
type SingleFormValues = z.infer<typeof SingleFormSchema>;

const EditFormSchema = z.object({
  startsAt: z.string().min(1, 'Pick a start date and time'),
  endsAt: z.string().min(1, 'Pick an end date and time'),
  durationMinutes: z.coerce.number().int().min(15).max(240),
});
type EditFormValues = z.infer<typeof EditFormSchema>;

type State = { kind: 'loading' } | { kind: 'ready'; items: Slot[] } | { kind: 'error' };

// Typed extractor for the route handler's `{ errors: { field: msg } }`
// envelope — keeps the catch handlers from juggling `as` casts.
function extractErrorMessage(cause: unknown, field: string): string | undefined {
  if (!cause || typeof cause !== 'object') return undefined;
  const errors = (cause as { errors?: unknown }).errors;
  if (!errors || typeof errors !== 'object') return undefined;
  const value = (errors as Record<string, unknown>)[field];
  return typeof value === 'string' ? value : undefined;
}

export function AvailabilityEditor() {
  const tDash = useTranslations('dashboard.instructor.availability');
  const tWeekday = useTranslations('availability.weekday');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [busySingle, setBusySingle] = useState(false);
  const [busyBulk, setBusyBulk] = useState(false);
  const [providerTimezone, setProviderTimezone] = useState(SWEDISH_TIMEZONE);

  const today = useMemo(() => new Date(), []);
  const defaultStartDate = useMemo(() => nextMondayIso(today), [today]);

  const weeklyForm = useForm<WeeklyFormValues>({
    resolver: zodResolver(WeeklyFormSchema),
    defaultValues: {
      weekdays: [1, 3, 5],
      startDate: defaultStartDate,
      timeOfDay: '14:00',
      weeksAhead: 4,
      durationMinutes: 60,
    },
  });
  const singleForm = useForm<SingleFormValues>({
    resolver: zodResolver(SingleFormSchema),
    defaultValues: { startsAt: '', endsAt: '', durationMinutes: 60 },
  });
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(EditFormSchema),
    defaultValues: { startsAt: '', endsAt: '', durationMinutes: 60 },
  });

  const refresh = useCallback(async (): Promise<Slot[]> => {
    const data = await apiFetch('/api/instructor-availability', {
      schema: AvailabilitySlotList,
    });
    if (data.items[0]?.timezone) setProviderTimezone(data.items[0].timezone);
    setState({ kind: 'ready', items: data.items });
    return data.items;
  }, []);

  useEffect(() => {
    let active = true;
    refresh().catch(() => {
      if (!active) return;
      setState({ kind: 'error' });
    });
    return () => {
      active = false;
    };
  }, [refresh]);

  const onBulkSubmit = weeklyForm.handleSubmit(async (values) => {
    setBusyBulk(true);
    try {
      await apiFetch('/api/instructor-availability', {
        method: 'POST',
        body: JSON.stringify({ mode: 'weekly', ...values }),
        schema: AvailabilitySlotList,
      });
      toast.success(tDash('submitBulkDone'));
      await refresh();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      toast.error(extractErrorMessage(cause, 'slots') ?? tDash('submitError'));
    } finally {
      setBusyBulk(false);
    }
  });

  const onSingleSubmit = singleForm.handleSubmit(async (values) => {
    if (!values.startsAt || !values.endsAt) {
      toast.error(tDash('invalidDate'));
      return;
    }
    const startsIso = localDateTimeToUtcIso(values.startsAt, providerTimezone);
    const endsIso = localDateTimeToUtcIso(values.endsAt, providerTimezone);
    if (!startsIso || !endsIso) {
      toast.error(tDash('invalidDate'));
      return;
    }
    setBusySingle(true);
    try {
      await apiFetch('/api/instructor-availability', {
        method: 'POST',
        body: JSON.stringify({
          mode: 'single',
          startsAt: startsIso,
          endsAt: endsIso,
          durationMinutes: values.durationMinutes,
        }),
        schema: AvailabilitySlotList,
      });
      toast.success(tDash('submitSingleDone'));
      singleForm.reset({ startsAt: '', endsAt: '', durationMinutes: values.durationMinutes });
      await refresh();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      toast.error(extractErrorMessage(cause, 'slots') ?? tDash('submitError'));
    } finally {
      setBusySingle(false);
    }
  });

  const startEdit = (slot: Slot) => {
    if (slot.bookedAt) return;
    const startsLocal = isoToLocalInput(slot.startsAt, slot.timezone);
    const endsLocal = isoToLocalInput(slot.endsAt, slot.timezone);
    editForm.reset({
      startsAt: startsLocal,
      endsAt: endsLocal,
      durationMinutes: slot.durationMinutes,
    });
    setEditingSlotId(slot.id);
  };

  const cancelEdit = () => {
    setEditingSlotId(null);
    editForm.reset({ startsAt: '', endsAt: '', durationMinutes: 60 });
  };

  const saveEdit = editForm.handleSubmit(async (values) => {
    if (!editingSlotId) return;
    const startsIso = localDateTimeToUtcIso(values.startsAt, providerTimezone);
    const endsIso = localDateTimeToUtcIso(values.endsAt, providerTimezone);
    if (!startsIso || !endsIso) {
      toast.error(tDash('invalidDate'));
      return;
    }
    try {
      await apiFetch(`/api/instructor-availability/${encodeURIComponent(editingSlotId)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          startsAt: startsIso,
          endsAt: endsIso,
          durationMinutes: values.durationMinutes,
        }),
      });
      toast.success(tDash('editSaved'));
      setEditingSlotId(null);
      await refresh();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      toast.error(extractErrorMessage(cause, 'startsAt') ?? tDash('submitError'));
    }
  });

  const onDelete = async (slot: Slot) => {
    if (slot.bookedAt) {
      toast.error(tDash('cannotDeleteBooked'));
      return;
    }
    const confirmed = window.confirm(tDash('deleteConfirm', { when: formatSlotRange(slot) }));
    if (!confirmed) return;
    try {
      await apiFetch(`/api/instructor-availability/${encodeURIComponent(slot.id)}`, {
        method: 'DELETE',
      });
      toast.success(tDash('deleteSaved'));
      await refresh();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      toast.error(extractErrorMessage(cause, 'slots') ?? tDash('cannotDeleteBooked'));
    }
  };

  if (state.kind === 'loading') {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (state.kind === 'error') {
    return (
      <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-small text-brand-700 dark:text-brand-300">{tDash('loadError')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setState({ kind: 'loading' });
              refresh().catch(() => setState({ kind: 'error' }));
            }}
            className="border-brand-500/40"
          >
            {tDash('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const slots = state.items;
  const openSlots = slots.filter((s) => s.bookedAt === null);
  const bookedCount = slots.length - openSlots.length;

  return (
    <div className="grid gap-6">
      <Card className="surface-panel border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{tDash('formWeeklyTitle')}</CardTitle>
          <CardDescription>{tDash('formWeeklyHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...weeklyForm}>
            <form onSubmit={onBulkSubmit} className="grid gap-4">
              <FormField
                control={weeklyForm.control}
                name="weekdays"
                render={({ field }) => {
                  const selected = new Set(field.value ?? []);
                  return (
                    <FormItem>
                      <FormLabel>{tDash('weekdayLabel')}</FormLabel>
                      <FormControl>
                        <div className="flex flex-wrap gap-2">
                          {WEEKDAYS.map((wd) => {
                            const isOn = selected.has(wd);
                            return (
                              <button
                                key={wd}
                                type="button"
                                aria-pressed={isOn}
                                onClick={() => {
                                  const nextSet = new Set(selected);
                                  if (nextSet.has(wd)) nextSet.delete(wd);
                                  else nextSet.add(wd);
                                  field.onChange([...nextSet].sort());
                                }}
                                className={cn(
                                  'flex h-10 w-12 items-center justify-center rounded-md border text-small font-medium uppercase transition-colors',
                                  isOn
                                    ? 'border-brand-500 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                                    : 'border-border bg-card text-muted-foreground hover:bg-muted',
                                )}
                              >
                                {tWeekday(String(wd) as '0' | '1' | '2' | '3' | '4' | '5' | '6')}
                              </button>
                            );
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={weeklyForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDash('startDateLabel')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={weeklyForm.control}
                  name="timeOfDay"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDash('timeOfDayLabel')}</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={weeklyForm.control}
                  name="weeksAhead"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDash('weeksAheadLabel')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={12} {...field} />
                      </FormControl>
                      <FormDescription>{tDash('weeksAheadHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={weeklyForm.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{tDash('durationLabel')}</FormLabel>
                      <FormControl>
                        <Input type="number" min={15} max={240} step={15} {...field} />
                      </FormControl>
                      <FormDescription>{tDash('durationHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={busyBulk} className="shadow-sm">
                {busyBulk ? tDash('submitBulkSubmitting') : tDash('submitBulk')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card className="surface-panel border-border bg-card">
        <CardHeader>
          <CardTitle>{tDash('formSingleTitle')}</CardTitle>
          <CardDescription>{tDash('formSingleHint')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...singleForm}>
            <form onSubmit={onSingleSubmit} className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={singleForm.control}
                name="startsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tDash('startAtLabel')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={singleForm.control}
                name="endsAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tDash('endsAtLabel')}</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={singleForm.control}
                name="durationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tDash('durationLabel')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={15} max={240} step={15} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                disabled={busySingle}
                className="sm:col-span-2"
                variant="secondary"
              >
                {busySingle ? tDash('submitSingleSubmitting') : tDash('submitSingle')}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow text-muted-foreground">{tDash('upcomingTitle')}</p>
          {bookedCount > 0 ? (
            <p className="text-caption font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {tDash('bookedCount', { count: bookedCount })}
            </p>
          ) : null}
        </div>
        {slots.length === 0 ? (
          <Card className="surface-panel border-border bg-card">
            <CardContent className="flex flex-col gap-2 p-8 text-center">
              <p className="text-body font-medium text-foreground">{tDash('emptyTitle')}</p>
              <p className="text-small text-muted-foreground">{tDash('emptyBody')}</p>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3">
            {slots.map((slot) => (
              <li key={slot.id}>
                <Card
                  className={cn(
                    'border-border bg-card transition-colors duration-200 hover:border-brand-500/40 hover:shadow-md',
                    slot.bookedAt && 'opacity-80',
                  )}
                >
                  <CardContent className="grid gap-3 p-5 sm:grid-cols-[2fr_1fr_auto] sm:items-center">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-display text-base font-semibold text-foreground">
                        {formatSlotRange(slot)}
                      </span>
                      <span className="text-small text-muted-foreground">
                        {tDash('slotDuration', { minutes: slot.durationMinutes })}
                      </span>
                    </div>
                    {slot.bookedAt ? (
                      <Badge
                        variant="outline"
                        className="border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300"
                      >
                        {tDash('bookedBadge')}
                      </Badge>
                    ) : editingSlotId === slot.id ? (
                      <Form {...editForm}>
                        <form
                          onSubmit={saveEdit}
                          className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto_auto]"
                        >
                          <FormField
                            control={editForm.control}
                            name="startsAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input type="datetime-local" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={editForm.control}
                            name="endsAt"
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input type="datetime-local" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="submit" size="sm" variant="secondary">
                            {tDash('saveEdit')}
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                            {tDash('cancelEdit')}
                          </Button>
                        </form>
                      </Form>
                    ) : (
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => startEdit(slot)}
                          disabled={Boolean(slot.bookedAt)}
                        >
                          {tDash('editRow')}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => onDelete(slot)}
                          disabled={Boolean(slot.bookedAt)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          {tDash('deleteRow')}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatSlotRange(slot: Slot): string {
  try {
    const start = new Date(slot.startsAt);
    const end = new Date(slot.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return slot.startsAt;
    const date = new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'medium',
      timeZone: slot.timezone,
    }).format(start);
    const startTime = new Intl.DateTimeFormat('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: slot.timezone,
    }).format(start);
    const endTime = new Intl.DateTimeFormat('sv-SE', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: slot.timezone,
    }).format(end);
    return `${date} ${startTime} – ${endTime}`;
  } catch {
    return slot.startsAt;
  }
}

function isoToLocalInput(iso: string, timezone: string): string {
  return utcToLocalDateTimeInput(iso, timezone);
}
