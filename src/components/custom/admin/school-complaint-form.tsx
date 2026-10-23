'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

const SCOPES = [
  'availability_display',
  'inquiry_collection',
  'request_to_book',
  'transactional_booking',
  'payment_collection',
] as const;

export function SchoolComplaintForm() {
  const [listingId, setListingId] = useState('');
  const [summary, setSummary] = useState('');
  const [evidenceRef, setEvidenceRef] = useState('');
  const [scopes, setScopes] = useState<string[]>(['request_to_book', 'transactional_booking']);
  const [result, setResult] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setResult(null);
    const response = await fetch(
      `/api/admin/listings/${encodeURIComponent(listingId)}/complaints`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          summary,
          evidenceRef,
          disputedScopes: scopes,
          idempotencyKey: `complaint-${listingId}-${Date.now()}`,
        }),
      },
    );
    const body = (await response.json().catch(() => null)) as {
      state?: string;
      surfaces?: unknown;
      error?: string;
    } | null;
    setPending(false);
    if (!response.ok) {
      setResult(body?.error ?? `Request failed (${response.status})`);
      return;
    }
    setResult(`${body?.state ?? 'recorded'}: ${JSON.stringify(body?.surfaces ?? {})}`);
  }

  return (
    <form onSubmit={onSubmit} className="grid max-w-xl gap-3">
      <label className="grid gap-1 text-sm">
        Listing id
        <input
          className="rounded-md border border-border bg-background px-3 py-2"
          value={listingId}
          onChange={(event) => setListingId(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Summary
        <textarea
          className="rounded-md border border-border bg-background px-3 py-2"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-sm">
        Evidence reference
        <input
          className="rounded-md border border-border bg-background px-3 py-2"
          value={evidenceRef}
          onChange={(event) => setEvidenceRef(event.target.value)}
          required
        />
      </label>
      <fieldset className="grid gap-1 text-sm">
        <legend>Scopes to suspend</legend>
        {SCOPES.map((scope) => (
          <label key={scope} className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={scopes.includes(scope)}
              onChange={(event) => {
                setScopes((current) =>
                  event.target.checked
                    ? [...current, scope]
                    : current.filter((item) => item !== scope),
                );
              }}
            />
            {scope}
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={pending}>
        {pending ? 'Suspending…' : 'Record complaint and suspend'}
      </Button>
      {result ? <p className="text-sm text-muted-foreground">{result}</p> : null}
    </form>
  );
}
