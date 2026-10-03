'use client';

import { useEffect, useState } from 'react';

type Row = {
  userId: string;
  dateOfBirth: string | null;
  dateOfBirthVerified: string | null;
  diditAttempts: number;
  diditLastDecision: string | null;
  updatedAt: string;
};

export function ManualReviewTable() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/manual-review');
      if (!res.ok) throw new Error(`status_${res.status}`);
      const body = (await res.json()) as { items: Row[] };
      setItems(body.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'load_failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function resolve(userId: string, outcome: 'ACTIVE' | 'BLOCKED_UNDERAGE') {
    const res = await fetch('/api/admin/manual-review', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, outcome }),
    });
    if (!res.ok) {
      setError(`resolve_${res.status}`);
      return;
    }
    await load();
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No learners in MANUAL_REVIEW.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-2 pr-3 font-medium">User</th>
            <th className="py-2 pr-3 font-medium">Claimed DOB</th>
            <th className="py-2 pr-3 font-medium">Verified DOB</th>
            <th className="py-2 pr-3 font-medium">Attempts</th>
            <th className="py-2 pr-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.userId} className="border-b border-border/60">
              <td className="py-2 pr-3 font-mono text-xs">{row.userId}</td>
              <td className="py-2 pr-3">{row.dateOfBirth?.slice(0, 10) ?? '—'}</td>
              <td className="py-2 pr-3">{row.dateOfBirthVerified?.slice(0, 10) ?? '—'}</td>
              <td className="py-2 pr-3">
                {row.diditAttempts} ({row.diditLastDecision ?? '—'})
              </td>
              <td className="py-2 pr-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground"
                    onClick={() => void resolve(row.userId, 'ACTIVE')}
                  >
                    Activate
                  </button>
                  <button
                    type="button"
                    className="rounded-md border border-border px-2 py-1 text-xs"
                    onClick={() => void resolve(row.userId, 'BLOCKED_UNDERAGE')}
                  >
                    Block
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
