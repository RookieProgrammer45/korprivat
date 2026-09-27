'use client';

import { CalendarClock, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { BookingContext } from '@/lib/contracts/messaging';

export function BookingContextCard({ booking }: { booking: BookingContext }) {
  const t = useTranslations('messaging');
  const locale = useLocale();
  return (
    <Card className="border-brand-500/25 bg-brand-100 shadow-none dark:bg-brand-900">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">
            {t('bookingContextTitle')}
          </p>
          <p className="font-medium text-foreground">
            {booking.instructorName} · {t('category', { category: booking.category })}
          </p>
          <p className="flex flex-wrap items-center gap-2 text-small text-muted-foreground">
            <CalendarClock
              className="h-4 w-4 text-brand-700 dark:text-brand-300"
              aria-hidden="true"
            />
            {t('scheduled', { date: formatDate(booking.scheduledAt, locale) })}
            <span aria-hidden="true">·</span>
            {t('duration', { minutes: booking.durationMinutes })}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="w-fit">
          <Link href={`/bookings/${encodeURIComponent(booking.bookingId)}`}>
            {t('backToBooking')}
            <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
