// @polsia:user-owned — accessible conversation list presentation.
'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { ConversationSummary } from '@/lib/contracts/messaging';

export function ConversationList({
  items,
  selectedId,
  onSelect,
}: {
  items: ConversationSummary[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTranslations('messaging');
  const locale = useLocale();
  return (
    <section aria-labelledby="conversation-list-title" className="grid gap-3">
      <h2 id="conversation-list-title" className="text-eyebrow text-muted-foreground">
        {t('accessibility.conversationList')}
      </h2>
      <div className="grid gap-2">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            aria-pressed={selectedId === item.id}
            onClick={() => onSelect(item.id)}
            className="h-auto justify-start whitespace-normal rounded-xl p-0 text-left"
          >
            <Card
              className={`w-full border-border transition-colors ${
                selectedId === item.id
                  ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                  : 'bg-card hover:border-brand-500'
              }`}
            >
              <CardContent className="grid gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-foreground">{item.otherParticipantName}</span>
                  {item.unreadCount > 0 ? (
                    <Badge className="shrink-0 bg-primary text-primary-foreground">
                      {item.unreadCount}
                    </Badge>
                  ) : null}
                </div>
                <span className="text-caption text-muted-foreground">
                  {formatDate(item.booking.scheduledAt, locale)}
                </span>
                <span className="line-clamp-2 text-small text-muted-foreground">
                  {item.lastMessage?.body ?? t('noMessages')}
                </span>
                {item.unreadCount > 0 ? (
                  <span className="text-caption font-medium text-brand-700 dark:text-brand-300">
                    {t('unread', { count: item.unreadCount })}
                  </span>
                ) : null}
              </CardContent>
            </Card>
          </Button>
        ))}
      </div>
    </section>
  );
}

function formatDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale === 'sv' ? 'sv-SE' : 'en-GB', {
    dateStyle: 'medium',
    timeZone: 'Europe/Stockholm',
  }).format(date);
}
