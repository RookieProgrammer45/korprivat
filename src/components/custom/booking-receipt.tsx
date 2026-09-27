'use client';

import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  MailCheck,
  MailX,
  MapPin,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { bookingAccessHeaders } from '@/components/custom/booking-access-headers';
import { PdfDownloadButton } from '@/components/custom/pdf-download-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  Receipt,
  type Receipt as ReceiptData,
  ReceiptResendResponse,
} from '@/lib/contracts/receipts';

export function BookingReceipt({ bookingId, token }: { bookingId: string; token?: string }) {
  const t = useTranslations('bookingReceipt');
  const locale = useLocale();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [resendState, setResendState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const load = useCallback(() => {
    setState('loading');
    apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/receipt`, {
      schema: Receipt,
      headers: bookingAccessHeaders(token),
    })
      .then((data) => {
        setReceipt(data);
        setResendState('idle');
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [bookingId, token]);

  useEffect(() => {
    load();
  }, [load]);

  const resend = async () => {
    setResendState('loading');
    try {
      const result = await apiFetch(
        `/api/bookings/${encodeURIComponent(bookingId)}/receipt/resend`,
        {
          method: 'POST',
          schema: ReceiptResendResponse,
          headers: bookingAccessHeaders(token),
        },
      );
      setReceipt((current) =>
        current ? { ...current, emailDeliveryStatus: result.emailDeliveryStatus } : current,
      );
      setResendState(result.emailDeliveryStatus === 'sent' ? 'success' : 'error');
    } catch {
      setResendState('error');
    }
  };

  if (state === 'loading') {
    return <ReceiptSkeleton />;
  }
  if (state === 'error' || !receipt) {
    return (
      <Card className="mx-auto max-w-2xl border-destructive/30 bg-card shadow-lg">
        <CardContent className="grid gap-4 p-6 sm:p-10">
          <p className="text-eyebrow text-destructive">{t('errorEyebrow')}</p>
          <h1 className="font-display text-h2 tracking-tight">{t('errorTitle')}</h1>
          <p className="text-body text-muted-foreground">{t('errorBody')}</p>
          <Button type="button" onClick={load}>
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const isLearner = receipt.recipientRole === 'learner';
  return (
    <article className="receipt-print-area mx-auto grid w-full max-w-3xl gap-6">
      <header className="receipt-header flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="grid gap-2">
          <p className="receipt-eyebrow text-eyebrow">{t('eyebrow')}</p>
          <h1 className="font-display text-display leading-none tracking-tight">{t('title')}</h1>
          <p className="receipt-lead text-body text-muted-foreground">
            {t(isLearner ? 'learnerLead' : 'instructorLead')}
          </p>
        </div>
        <Badge className="receipt-issued-badge w-fit gap-2">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t('issued')}
        </Badge>
      </header>

      <Card className="receipt-card overflow-hidden">
        <CardHeader className="receipt-card-header p-6 sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid gap-2">
              <CardTitle className="font-display text-h2">{receipt.instructorName}</CardTitle>
              <p className="receipt-subtitle text-body text-muted-foreground">
                {t('lessonWith', { name: receipt.learnerName })}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="receipt-meta-label text-caption uppercase tracking-[0.14em]">
                {t('receiptNumber')}
              </p>
              <p className="receipt-meta-value font-mono text-small font-medium">
                {receipt.receiptNumber}
              </p>
            </div>
          </div>
          <div className="receipt-facts grid gap-3 pt-3 text-small sm:grid-cols-3">
            <Fact
              icon={<CalendarDays />}
              label={t('date')}
              value={formatDate(receipt.scheduledAt, locale)}
            />
            <Fact
              icon={<Clock3 />}
              label={t('duration')}
              value={t('minutes', { count: receipt.durationMinutes })}
            />
            <Fact icon={<MapPin />} label={t('location')} value={receipt.instructorCity} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-6 p-6 sm:p-8">
          <div className="receipt-status-panel flex flex-wrap items-center justify-between gap-3 rounded-xl p-4">
            <div>
              <p className="receipt-status-label text-caption uppercase tracking-[0.14em]">
                {t('paymentStatus')}
              </p>
              <p className="receipt-status-value font-display text-h4 font-semibold">
                {statusLabel(receipt.paymentStatus, t)}
              </p>
            </div>
            <Badge variant="outline" className="receipt-role-badge">
              {t(isLearner ? 'learnerReceipt' : 'instructorReceipt')}
            </Badge>
          </div>

          <ReceiptDeliveryNotice
            status={receipt.emailDeliveryStatus}
            resendState={resendState}
            onResend={() => void resend()}
            t={t}
          />

          <div className="grid gap-3">
            <p className="receipt-breakdown-label text-eyebrow">{t('breakdown')}</p>
            {isLearner ? (
              <>
                <MoneyRow
                  label={t('items.lesson')}
                  value={formatSek(receipt.lessonPriceSek, locale)}
                />
                {receipt.serviceFeeSek > 0 ? (
                  <MoneyRow
                    label={t('items.serviceFee')}
                    value={formatSek(receipt.serviceFeeSek, locale)}
                  />
                ) : null}
                <MoneyRow
                  emphasized
                  label={t('totalPaid')}
                  value={formatSek(receipt.totalPaidSek, locale)}
                />
              </>
            ) : (
              <>
                <MoneyRow
                  label={t('items.grossPaid')}
                  value={formatSek(receipt.grossChargedSek, locale)}
                />
                {receipt.serviceFeeSek > 0 ? (
                  <MoneyRow
                    label={t('items.serviceFee')}
                    value={`−${formatSek(receipt.serviceFeeSek, locale)}`}
                  />
                ) : null}
                <MoneyRow
                  label={t('items.commission')}
                  value={`−${formatSek(receipt.commissionSek, locale)}`}
                />
                <MoneyRow
                  emphasized
                  label={t('netPayout')}
                  value={formatSek(receipt.netPayoutSek, locale)}
                />
                <MoneyRow label={t('payoutStatus')} value={payoutLabel(receipt.payoutStatus, t)} />
                <p className="border-t pt-3 text-small text-muted-foreground">
                  {t('reconciliation')}
                </p>
              </>
            )}
          </div>

          <p className="receipt-verified-charge border-t pt-4 text-small">
            {t('verifiedCharge', {
              usd: formatUsd(receipt.verifiedAmountUsd, locale),
            })}
          </p>
        </CardContent>
      </Card>

      <div className="receipt-actions flex flex-wrap gap-3 print:hidden">
        <PdfDownloadButton
          endpoint={`/api/bookings/${encodeURIComponent(bookingId)}/receipt/pdf`}
          requestHeaders={bookingAccessHeaders(token)}
          className="receipt-action receipt-action-download"
          variant="secondary"
        >
          {t('download')}
        </PdfDownloadButton>
        <Button
          type="button"
          variant="outline"
          className="receipt-action receipt-action-print"
          onClick={() => window.print()}
        >
          <Printer className="size-4" aria-hidden="true" />
          {t('print')}
        </Button>
        <Button
          asChild
          type="button"
          variant="ghost"
          className="receipt-action receipt-action-back"
        >
          <Link
            href={`/bookings/${encodeURIComponent(bookingId)}${token ? `?token=${encodeURIComponent(token)}` : ''}`}
          >
            {t('backToBooking')}
          </Link>
        </Button>
      </div>
    </article>
  );
}

function ReceiptDeliveryNotice({
  status,
  resendState,
  onResend,
  t,
}: {
  status: ReceiptData['emailDeliveryStatus'];
  resendState: 'idle' | 'loading' | 'success' | 'error';
  onResend: () => void;
  t: ReturnType<typeof useTranslations<'bookingReceipt'>>;
}) {
  const failed = status === 'failed';
  const pending = status === 'pending' || status === 'sending';
  const title = failed
    ? t('delivery.failed')
    : status === 'sent'
      ? t('delivery.sent')
      : pending
        ? t('delivery.pending')
        : t('delivery.unknown');
  return (
    <div
      className={`grid gap-2 rounded-xl border px-4 py-3 ${failed ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-muted'}`}
      role={failed ? 'alert' : undefined}
    >
      <div className="flex items-center gap-2">
        {failed ? (
          <MailX className="size-4 text-destructive" aria-hidden="true" />
        ) : (
          <MailCheck className="size-4 text-muted-foreground" aria-hidden="true" />
        )}
        <p className="text-small font-medium">{title}</p>
      </div>
      {failed ? (
        <>
          <p className="text-small text-muted-foreground">{t('delivery.failedBody')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            disabled={resendState === 'loading'}
            onClick={onResend}
          >
            {resendState === 'loading' ? t('delivery.retrying') : t('delivery.retry')}
          </Button>
          {resendState === 'success' ? (
            <p className="text-small text-brand-700 dark:text-brand-300">
              {t('delivery.retrySucceeded')}
            </p>
          ) : resendState === 'error' ? (
            <p className="text-small text-destructive">{t('delivery.retryFailed')}</p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function Fact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="receipt-fact-icon mt-0.5">{icon}</span>
      <span>
        <span className="receipt-fact-label block text-caption uppercase tracking-[0.12em]">
          {label}
        </span>
        <span className="receipt-fact-value block font-medium">{value}</span>
      </span>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  emphasized = false,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`receipt-money-row flex items-start justify-between gap-4 border-b pb-3 ${emphasized ? 'receipt-money-row-emphasized pt-2 font-display text-h4 font-semibold' : 'text-body'}`}
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 text-right tabular-nums">{value}</span>
    </div>
  );
}

function ReceiptSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6">
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-[28rem] w-full" />
    </div>
  );
}

function statusLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'bookingReceipt'>>,
): string {
  return t(`statuses.${status}` as never);
}

function payoutLabel(
  status: string,
  t: ReturnType<typeof useTranslations<'bookingReceipt'>>,
): string {
  return t(`payoutStatuses.${status}` as never);
}

function formatDate(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(new Date(iso));
}

function formatSek(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency: 'SEK',
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatUsd(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}
