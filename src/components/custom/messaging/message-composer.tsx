'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { type ConversationMessage, SendMessageResponse } from '@/lib/contracts/messaging';

export function MessageComposer({
  conversationId,
  onSent,
}: {
  conversationId: string;
  onSent: (message: ConversationMessage) => void;
}) {
  const t = useTranslations('messaging');
  const [body, setBody] = useState('');
  const [blockedCategories, setBlockedCategories] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setBlockedCategories([]);
    try {
      const result = await apiFetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ body }),
          schema: SendMessageResponse,
        },
      );
      if (result.status === 'blocked') {
        setBlockedCategories(result.categories);
        return;
      }
      onSent(result.message);
      setBody('');
    } catch {
      toast.error(t('sendError'));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-2 border-t border-border pt-4">
      {blockedCategories.length > 0 ? (
        <div
          role="alert"
          className="grid gap-1 rounded-lg border border-brand-500/35 bg-brand-100 p-3 dark:bg-brand-900"
        >
          <p className="text-small font-semibold text-foreground">{t('blockedTitle')}</p>
          <p className="text-small text-muted-foreground">
            {t('blockedBody')}{' '}
            {blockedCategories.map((category) => t(`guardrails.${category}`)).join(', ')}.
          </p>
          <p className="text-small text-muted-foreground">{t('alternative')}</p>
        </div>
      ) : null}
      <label htmlFor="message-body" className="sr-only">
        {t('messageLabel')}
      </label>
      <Textarea
        id="message-body"
        value={body}
        maxLength={2000}
        rows={3}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t('placeholder')}
        className="min-h-24 resize-y rounded-xl bg-background"
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-caption text-muted-foreground">{t('safetyNote')}</p>
        <Button type="submit" size="sm" disabled={sending || !body.trim()}>
          {sending ? t('sending') : t('send')}
        </Button>
      </div>
    </form>
  );
}
