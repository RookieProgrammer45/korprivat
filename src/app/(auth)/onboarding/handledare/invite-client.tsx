'use client';

import { useState } from 'react';

export function HandledareInviteClient() {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/verification/handledare/invite', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          handledareEmail: email,
          handledareName: name || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? 'invite_failed');
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
        Inbjudan skickad. Din handledare måste godkänna innan du kan boka.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="grid gap-3">
      <label className="grid gap-1 text-sm">
        <span>Handledarens e-post</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>Namn (valfritt)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3"
        />
      </label>
      <button
        type="submit"
        disabled={status === 'loading'}
        className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status === 'loading' ? 'Skickar…' : 'Skicka inbjudan'}
      </button>
      {error ? <p className="text-sm text-destructive">Kunde inte skicka ({error}).</p> : null}
    </form>
  );
}
