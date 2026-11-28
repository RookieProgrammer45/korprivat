'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { sendVehicleMessage } from '@/lib/vehicle-sales/actions';

export function VehicleThreadComposer({
  listingId,
  conversationId,
}: {
  listingId: string;
  conversationId: string | null;
}) {
  const t = useTranslations('carsForSalePage');
  const router = useRouter();
  const [body, setBody] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        void sendVehicleMessage({ listingId, conversationId, body })
          .then((result) => {
            setPending(false);
            if (!result.ok) {
              setError(t(`errors.${result.error}`));
              return;
            }
            setBody('');
            router.refresh();
          })
          .catch(() => {
            setPending(false);
            setError(t('errors.invalid'));
          });
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>{t('thread.message')}</span>
        <textarea
          className="min-h-24 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
          minLength={1}
          maxLength={2000}
          required
          value={body}
          onChange={(event) => setBody(event.target.value)}
        />
      </label>
      <Button type="submit" disabled={pending || body.trim() === ''} className="min-h-11">
        {pending ? t('thread.sending') : t('thread.send')}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </form>
  );
}
