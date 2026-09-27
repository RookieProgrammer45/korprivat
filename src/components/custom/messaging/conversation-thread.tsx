'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  type ConversationDetail,
  type ConversationMessage,
  ReadResponse,
} from '@/lib/contracts/messaging';
import { BookingContextCard } from './booking-context-card';
import { MessageComposer } from './message-composer';
import { MessageReportDialog } from './message-report-dialog';

export function ConversationThread({
  detail,
  onSent,
}: {
  detail: ConversationDetail;
  onSent: (message: ConversationMessage) => void;
}) {
  const t = useTranslations('messaging');
  const locale = useLocale();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void apiFetch(`/api/conversations/${encodeURIComponent(detail.conversation.id)}/read`, {
      method: 'POST',
      schema: ReadResponse,
    }).catch(() => undefined);
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [detail.conversation.id]);

  return (
    <section className="grid min-h-[32rem] gap-4" aria-labelledby="conversation-title">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
        <div className="grid gap-1">
          <p className="text-eyebrow text-muted-foreground">{t('eyebrow')}</p>
          <h2
            id="conversation-title"
            className="font-display text-h3 tracking-tight text-foreground"
          >
            {detail.conversation.otherParticipantName}
          </h2>
          {detail.conversation.unreadCount > 0 ? (
            <Badge className="w-fit bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
              {t('unread', { count: detail.conversation.unreadCount })}
            </Badge>
          ) : (
            <span className="text-caption text-muted-foreground">{t('read')}</span>
          )}
        </div>
        <MessageReportDialog conversationId={detail.conversation.id} />
      </div>
      <BookingContextCard booking={detail.conversation.booking} />
      <div
        role="log"
        className="grid min-h-48 content-start gap-3 overflow-y-auto rounded-xl border border-border bg-background p-3 sm:max-h-[34rem] sm:p-4"
        aria-label={t('accessibility.messageList')}
      >
        {detail.messages.length === 0 ? (
          <p className="self-center py-8 text-center text-small text-muted-foreground">
            {t('noMessages')}
          </p>
        ) : (
          detail.messages.map((message) => (
            <MessageBubble key={message.id} message={message} locale={locale} t={t} />
          ))
        )}
        <div ref={bottomRef} aria-hidden="true" />
      </div>
      <MessageComposer conversationId={detail.conversation.id} onSent={onSent} />
    </section>
  );
}

function MessageBubble({
  message,
  locale,
  t,
}: {
  message: ConversationMessage;
  locale: string;
  t: ReturnType<typeof useTranslations<'messaging'>>;
}) {
  return (
    <div className={`flex ${message.isMine ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[88%] border border-border shadow-none ${message.isMine ? 'bg-brand-100 dark:bg-brand-900' : 'bg-card'}`}
      >
        <CardContent className="grid gap-1 px-3 py-2.5">
          <div className="flex items-baseline gap-2">
            <span className="text-caption font-semibold text-foreground">
              {message.isMine ? t('sentByYou') : message.senderName}
            </span>
            <time className="text-[11px] text-muted-foreground" dateTime={message.createdAt}>
              {formatTime(message.createdAt, locale)}
            </time>
          </div>
          <p className="whitespace-pre-wrap break-words text-small text-foreground">
            {message.body}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function formatTime(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
