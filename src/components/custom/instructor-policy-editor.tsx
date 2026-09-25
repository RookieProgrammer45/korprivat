// @polsia:user-owned — Instructor dashboard's cancellation-policy editor
// island. Loads the signed-in instructor's current tier on mount, lets
// them pick a new tier from a three-option RadioGroup, and PATCHes
// /api/instructors/me on save. Lives on the instructor dashboard page
// (mounted ABOVE the request list) so it sits where the operator who
// lists their profile naturally opens their settings.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { CANCELLATION_TIERS, type CancellationTier } from '@/lib/business/cancellation-policy';
import {
  type InstructorMe,
  InstructorMe as InstructorMeSchema,
  type InstructorPolicyUpdated,
  InstructorPolicyUpdated as InstructorPolicyUpdatedSchema,
  type InstructorPolicyUpdateRequest,
  InstructorPolicyUpdate as InstructorPolicyUpdateSchema,
} from '@/lib/contracts/instructors';

type Status =
  | { kind: 'loading' }
  | { kind: 'no-instructor-row' }
  | {
      kind: 'ready';
      selected: CancellationTier;
      original: CancellationTier | null;
      bookingMode: 'instant' | 'request';
      bookingModeOriginal: 'instant' | 'request';
      saving: boolean;
      dirty: boolean;
    };

export function InstructorPolicyEditor() {
  const tr = useTranslations('cancellationPolicy.editor');
  const trTier = useTranslations('cancellationPolicy');
  const trBooking = useTranslations('bookingForm.bookingMode');

  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/instructors/me', { schema: InstructorMeSchema })
      .then((data: InstructorMe) => {
        if (!active) return;
        const liveTier: CancellationTier =
          data.cancellationPolicyTier === 'moderate' || data.cancellationPolicyTier === 'strict'
            ? data.cancellationPolicyTier
            : 'flexible';
        const liveBookingMode: 'instant' | 'request' =
          data.bookingMode === 'request' ? 'request' : 'instant';
        setStatus({
          kind: 'ready',
          selected: liveTier,
          original: liveTier,
          bookingMode: liveBookingMode,
          bookingModeOriginal: liveBookingMode,
          saving: false,
          dirty: false,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        // `apiFetch` re-throws with `cause === JSON body` from the route
        // handler. The not-found path emits `{ errors: { id: 'No instructor row ...' } }`;
        // we surface it as the editor's "finish onboarding first" state
        // instead of a generic error toast.
        const body = err instanceof Error ? err.cause : null;
        const idError: unknown =
          body && typeof body === 'object' && 'errors' in body
            ? (body as { errors?: { id?: unknown } }).errors?.id
            : undefined;
        if (typeof idError === 'string' && idError.startsWith('No instructor row')) {
          setStatus({ kind: 'no-instructor-row' });
          return;
        }
        toast.error(tr('error'));
      });
    return () => {
      active = false;
    };
  }, [tr]);

  if (status.kind === 'loading') {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-2/5" />
        <Skeleton className="h-4 w-full" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }

  if (status.kind === 'no-instructor-row') {
    return (
      <div className="rounded-lg border border-brand-500/40 bg-brand-100 p-4 dark:bg-brand-900">
        <p className="text-small text-brand-700 dark:text-brand-300">{tr('noInstructorRow')}</p>
      </div>
    );
  }

  const onSelect = (next: string) => {
    if (!(CANCELLATION_TIERS as readonly string[]).includes(next)) return;
    setStatus((curr) => {
      if (curr.kind !== 'ready') return curr;
      return {
        ...curr,
        selected: next as CancellationTier,
        dirty: next !== curr.original,
      };
    });
  };

  const onBookingModeSelect = (next: 'instant' | 'request') => {
    setStatus((curr) => {
      if (curr.kind !== 'ready') return curr;
      return {
        ...curr,
        bookingMode: next,
        dirty: next !== curr.bookingModeOriginal,
      };
    });
  };

  const onSave = async () => {
    if (status.kind !== 'ready') return;
    setStatus((curr) => (curr.kind === 'ready' ? { ...curr, saving: true } : curr));
    try {
      const body: InstructorPolicyUpdateRequest = {
        tier: status.selected,
        bookingMode: status.bookingMode,
      };
      const result: InstructorPolicyUpdated = await apiFetch('/api/instructors/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
        schema: InstructorPolicyUpdatedSchema,
      });
      const newTier: CancellationTier =
        result.cancellationPolicyTier === 'moderate' || result.cancellationPolicyTier === 'strict'
          ? result.cancellationPolicyTier
          : 'flexible';
      const newBookingMode: 'instant' | 'request' =
        result.bookingMode === 'request' ? 'request' : 'instant';
      setStatus({
        kind: 'ready',
        selected: newTier,
        original: newTier,
        bookingMode: newBookingMode,
        bookingModeOriginal: newBookingMode,
        saving: false,
        dirty: false,
      });
      toast.success(tr('saved'));
    } catch {
      setStatus((curr) => (curr.kind === 'ready' ? { ...curr, saving: false } : curr));
      toast.error(tr('error'));
    }
  };

  // Validate body shape server-side: schema is reusable so EditorSource
  // type-checks the literal we send.
  InstructorPolicyUpdateSchema.parse;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-eyebrow text-muted-foreground">{tr('title')}</p>
        <p className="mt-1 text-small text-muted-foreground">{tr('description')}</p>
      </div>
      <RadioGroup
        value={status.selected}
        onValueChange={onSelect}
        className="grid gap-3 sm:grid-cols-3"
      >
        <TierOption
          value="flexible"
          label={tr('flexibleLabel')}
          summary={tr('flexibleSummary')}
          tierName={trTier('tierBadge.flexible')}
        />
        <TierOption
          value="moderate"
          label={tr('moderateLabel')}
          summary={tr('moderateSummary')}
          tierName={trTier('tierBadge.moderate')}
        />
        <TierOption
          value="strict"
          label={tr('strictLabel')}
          summary={tr('strictSummary')}
          tierName={trTier('tierBadge.strict')}
        />
      </RadioGroup>
      <div className="flex flex-col gap-3">
        <p className="text-eyebrow text-muted-foreground">{trBooking('title')}</p>
        <p className="text-small text-muted-foreground">{trBooking('description')}</p>
        <RadioGroup
          value={status.bookingMode}
          onValueChange={(v) => onBookingModeSelect(v === 'request' ? 'request' : 'instant')}
          className="grid gap-3 sm:grid-cols-2"
        >
          <BookingModeOption
            value="instant"
            label={trBooking('instantLabel')}
            summary={trBooking('instantSummary')}
            modeName={trBooking('instantName')}
          />
          <BookingModeOption
            value="request"
            label={trBooking('requestLabel')}
            summary={trBooking('requestSummary')}
            modeName={trBooking('requestName')}
          />
        </RadioGroup>
      </div>
      <div className="dl-action-group">
        <Button
          type="button"
          variant="default"
          disabled={status.saving || !status.dirty}
          onClick={() => void onSave()}
        >
          {status.saving ? tr('saving') : tr('save')}
        </Button>
      </div>
    </div>
  );
}

function TierOption({
  value,
  label,
  summary,
  tierName,
}: {
  value: CancellationTier;
  label: string;
  summary: string;
  tierName: string;
}) {
  const id = `tier-${value}`;
  return (
    <div className="group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-background p-4 transition-colors hover:border-brand-500 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-100 dark:has-[[data-state=checked]]:bg-brand-900">
      <RadioGroupItem
        id={id}
        value={value}
        aria-label={label}
        className="absolute inset-0 z-10 h-full w-full rounded-lg border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>span]:hidden"
      />
      <div aria-hidden="true" className="pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between font-display text-h4 font-semibold tracking-tight text-foreground">
          {tierName}
        </div>
        <p className="text-small text-muted-foreground">{summary}</p>
      </div>
    </div>
  );
}

// `BookingModeOption` is a sibling of `TierOption` — same UI surface,
// different data. Renders inside `RadioGroup`'s 2-col grid so the picker
// shares style with the tier picker and reads with the same accessible
// shape with a full-card click target and a keyboard-accessible radio.
function BookingModeOption({
  value,
  label,
  summary,
  modeName,
}: {
  value: 'instant' | 'request';
  label: string;
  summary: string;
  modeName: string;
}) {
  const id = `booking-mode-${value}`;
  return (
    <div className="group relative flex cursor-pointer flex-col gap-2 rounded-lg border border-border bg-background p-4 transition-colors hover:border-brand-500 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-100 dark:has-[[data-state=checked]]:bg-brand-900">
      <RadioGroupItem
        id={id}
        value={value}
        aria-label={label}
        className="absolute inset-0 z-10 h-full w-full rounded-lg border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>span]:hidden"
      />
      <div aria-hidden="true" className="pointer-events-none flex flex-col gap-2">
        <div className="flex items-center justify-between font-display text-h4 font-semibold tracking-tight text-foreground">
          {modeName}
        </div>
        <p className="text-small text-muted-foreground">{summary}</p>
      </div>
    </div>
  );
}
