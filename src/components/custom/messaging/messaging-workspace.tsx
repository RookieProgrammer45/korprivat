'use client';

import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  ConversationDetail,
  ConversationList,
  type ConversationMessage,
  type ConversationSummary,
  CreateConversationResult,
} from '@/lib/contracts/messaging';
import { ConversationList as ConversationListView } from './conversation-list';
import { ConversationThread } from './conversation-thread';

type ListState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: ConversationSummary[] };

export function MessagingWorkspace({ initialBookingId }: { initialBookingId?: string }) {
  const t = useTranslations('messaging');
  const [listState, setListState] = useState<ListState>({ kind: 'loading' });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [_retryNonce, setRetry] = useState(0);

  const header = (
    <header className="grid gap-2">
      <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
      <h1 className="font-display text-h1 tracking-tight text-foreground">{t('title')}</h1>
      <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
    </header>
  );

  const loadDetail = useCallback(async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    try {
      const nextDetail = await apiFetch(`/api/conversations/${encodeURIComponent(id)}`, {
        schema: ConversationDetail,
      });
      setDetail(nextDetail);
      setListState((current) =>
        current.kind === 'ready'
          ? {
              kind: 'ready',
              items: current.items.map((item) =>
                item.id === id ? { ...item, unreadCount: 0 } : item,
              ),
            }
          : current,
      );
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    setListState({ kind: 'loading' });
    setDetail(null);
    async function load() {
      try {
        let data = await apiFetch('/api/conversations', {
          schema: ConversationList,
        });
        if (initialBookingId) {
          const opened = await apiFetch('/api/conversations', {
            method: 'POST',
            body: JSON.stringify({ bookingId: initialBookingId }),
            schema: CreateConversationResult,
          });
          const withoutOpened = data.items.filter((item) => item.id !== opened.conversation.id);
          data = { items: [opened.conversation, ...withoutOpened] };
        }
        if (!active) return;
        setListState({ kind: 'ready', items: data.items });
        const nextId = initialBookingId
          ? data.items[0]?.id
          : (data.items.find((item) => item.unreadCount > 0)?.id ?? data.items[0]?.id);
        if (nextId) void loadDetail(nextId);
      } catch {
        if (active) setListState({ kind: 'error' });
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [initialBookingId, loadDetail]);

  function handleSent(message: ConversationMessage) {
    setDetail((current) =>
      current ? { ...current, messages: [...current.messages, message] } : current,
    );
    setListState((current) => {
      if (current.kind !== 'ready' || !selectedId) return current;
      return {
        kind: 'ready',
        items: current.items.map((item) =>
          item.id === selectedId
            ? {
                ...item,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: 0,
              }
            : item,
        ),
      };
    });
  }

  if (listState.kind === 'loading') {
    return (
      <div className="grid gap-6">
        {header}
        <Skeleton className="h-[34rem] w-full rounded-2xl" />
      </div>
    );
  }
  if (listState.kind === 'error') {
    return (
      <div className="grid gap-6">
        {header}
        <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
          <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-small text-brand-700 dark:text-brand-300">{t('errorTitle')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRetry((value) => value + 1)}
            >
              {t('retry')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  if (listState.items.length === 0) {
    return (
      <div className="grid gap-6">
        {header}
        <Card className="surface-panel border-border bg-card">
          <CardContent className="grid gap-2 p-8">
            <p className="text-body font-medium text-foreground">{t('emptyTitle')}</p>
            <p className="max-w-xl text-small text-muted-foreground">{t('emptyBody')}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {header}
      <div className="grid gap-4 lg:grid-cols-[minmax(15rem,0.35fr)_minmax(0,1fr)]">
        <Card className="surface-panel border-border bg-card">
          <CardContent className="p-3 sm:p-4">
            <ConversationListView
              items={listState.items}
              selectedId={selectedId}
              onSelect={(id) => void loadDetail(id)}
            />
          </CardContent>
        </Card>
        <Card className="surface-panel min-w-0 border-border bg-card">
          <CardContent className="p-4 sm:p-6">
            {detailLoading ? (
              <div className="grid gap-4">
                <Skeleton className="h-12 w-1/2" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-64 w-full" />
              </div>
            ) : detail ? (
              <ConversationThread detail={detail} onSent={handleSent} />
            ) : (
              <p className="grid min-h-64 place-items-center text-small text-muted-foreground">
                {t('selectPrompt')}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
