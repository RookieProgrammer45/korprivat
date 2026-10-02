//
// Surfaces the single highest-priority learner action on the student
// dashboard (pay → confirm lesson → leave review) so next steps are not
// buried only inside booking history.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import {
  BookingHistoryList,
  type BookingHistoryItem,
} from '@/lib/contracts/bookings';

type NextAction =
  | { kind: 'pay'; bookingId: string; instructorName: string }
  | { kind: 'confirm'; bookingId: string; instructorName: string }
  | { kind: 'review'; bookingId: string; instructorId: string; instructorName: string };

function pickNextAction(items: BookingHistoryItem[]): NextAction | null {
  const unpaid = items.find(
    (row) =>
      row.cancellationOutcome === null &&
      (row.paymentStatus === 'unpaid' || row.paymentStatus === 'pending'),
  );
  if (unpaid) {
    return {
      kind: 'pay',
      bookingId: unpaid.id,
      instructorName: unpaid.instructorName,
    };
  }

  const confirm = items.find(
    (row) =>
      row.cancellationOutcome === null &&
      row.disputeStatus !== 'open' &&
      row.paymentStatus === 'awaiting_buyer_confirmation',
  );
  if (confirm) {
    return {
      kind: 'confirm',
      bookingId: confirm.id,
      instructorName: confirm.instructorName,
    };
  }

  const review = items.find(
    (row) =>
      row.cancellationOutcome === null &&
      row.disputeStatus !== 'open' &&
      row.completedAt != null &&
      row.paymentStatus === 'released',
  );
  if (review) {
    return {
      kind: 'review',
      bookingId: review.id,
      instructorId: review.instructorId,
      instructorName: review.instructorName,
    };
  }

  return null;
}

export function StudentNextActionBanner() {
  const t = useTranslations('dashboard.student.nextAction');
  const [action, setAction] = useState<NextAction | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    apiFetch('/api/bookings/me/history', { schema: BookingHistoryList })
      .then((data) => {
        if (!active) return;
        setAction(pickNextAction(data.items));
      })
      .catch(() => {
        if (!active) return;
        setAction(null);
      });
    return () => {
      active = false;
    };
  }, []);

  if (action === undefined || action === null) {
    return null;
  }

  const href =
    action.kind === 'pay'
      ? `/bookings/${encodeURIComponent(action.bookingId)}`
      : action.kind === 'confirm'
        ? `/dashboard/student/bookings`
        : `/instructors/${encodeURIComponent(action.instructorId)}?review=${encodeURIComponent(action.bookingId)}`;

  const title =
    action.kind === 'pay'
      ? t('payTitle')
      : action.kind === 'confirm'
        ? t('confirmTitle')
        : t('reviewTitle');

  const body =
    action.kind === 'pay'
      ? t('payBody', { name: action.instructorName })
      : action.kind === 'confirm'
        ? t('confirmBody', { name: action.instructorName })
        : t('reviewBody', { name: action.instructorName });

  const cta =
    action.kind === 'pay'
      ? t('payCta')
      : action.kind === 'confirm'
        ? t('confirmCta')
        : t('reviewCta');

  return (
    <aside className="flex flex-col gap-3 rounded-xl border border-brand-500/35 bg-brand-50/80 px-4 py-3 text-small text-foreground sm:flex-row sm:items-center sm:justify-between dark:bg-brand-950/40">
      <div className="grid gap-1">
        <p className="text-pretty font-medium">{title}</p>
        <p className="text-pretty text-muted-foreground">{body}</p>
      </div>
      <Button asChild className="sm:shrink-0">
        <Link href={href}>{cta}</Link>
      </Button>
    </aside>
  );
}
