'use client';

import { useState } from 'react';

export function HandledareApproveClient({ token }: { token: string }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onApprove() {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/verification/handledare/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'approve_failed');
        setStatus('error');
        return;
      }
      setStatus('ok');
    } catch {
      setError('network');
      setStatus('error');
    }
  }

  if (status === 'ok') {
    return (
      <p className="rounded-md border border-border bg-muted/40 p-4 text-sm">
        Tack — handledarskapet är godkänt. Eleven kan nu boka lektioner.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={() => void onApprove()}
        disabled={status === 'loading'}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status === 'loading' ? 'Godkänner…' : 'Jag godkänner handledarskap'}
      </button>
      {error ? (
        <p className="text-sm text-destructive">
          Kunde inte godkänna ({error}). Länken kan ha gått ut — be eleven skicka en ny.
        </p>
      ) : null}
    </div>
  );
}
