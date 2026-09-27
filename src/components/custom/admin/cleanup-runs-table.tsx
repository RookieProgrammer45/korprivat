//
// Fetches `/api/admin/cleanup-runs` on mount, renders the last 50
// CleanupRun rows with loading / empty / error states per the
// nextjs-data-plane skill, and exposes a "Run cleanup now" button
// that POSTs to the same route, then refetches the list.
//
// No server-only deps — the page wrapper (`page.tsx`) owns auth/db.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import type { CleanupRunSummary } from '@/lib/contracts/cleanup-runs';
import { CleanupRunCreated, CleanupRunsList } from '@/lib/contracts/cleanup-runs';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; runs: CleanupRunSummary[]; running: boolean };

async function fetchRuns(): Promise<CleanupRunSummary[]> {
  const data = await apiFetch('/api/admin/cleanup-runs', { schema: CleanupRunsList });
  return data.items;
}

export function CleanupRunsTable() {
  const t = useTranslations();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const runs = await fetchRuns();
        if (!cancelled) setState({ kind: 'ready', runs, running: false });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRunNow() {
    setState((s) => (s.kind === 'ready' ? { ...s, running: true } : s));
    try {
      const result = await apiFetch('/api/admin/cleanup-runs', {
        method: 'POST',
        body: JSON.stringify({}),
        schema: CleanupRunCreated,
      });
      const items = await fetchRuns();
      setState({ kind: 'ready', runs: items, running: false });
      toast.success(
        result.deleted === 0
          ? 'Run complete — no orphans found.'
          : `Run complete — deleted ${result.deleted} orphan${result.deleted === 1 ? '' : 's'} of ${result.scanned} scanned.`,
      );
    } catch {
      setState((s) => (s.kind === 'ready' ? { ...s, running: false } : s));
      toast.error('Cleanup run failed. Check the server logs.');
    }
  }

  if (state.kind === 'loading') {
    return <p className="text-body text-muted-foreground">…</p>;
  }
  if (state.kind === 'error') {
    return (
      <div className="grid gap-2">
        <p className="text-body text-foreground">
          {t('dashboard.student.loadError') ?? 'Could not load cleanup runs.'}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-small text-muted-foreground">
          {state.runs.length === 0
            ? 'No cleanup runs recorded yet.'
            : `Last ${state.runs.length} run${state.runs.length === 1 ? '' : 's'} (most recent first).`}
        </p>
        <Button
          type="button"
          variant="default"
          size="sm"
          onClick={handleRunNow}
          disabled={state.running}
        >
          {state.running ? 'Running…' : 'Run cleanup now'}
        </Button>
      </div>
      {state.runs.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-border bg-card">
          <table className="min-w-full divide-y divide-border text-small">
            <thead className="bg-card text-left text-eyebrow text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Trigger</th>
                <th className="px-3 py-2 font-medium">Scanned</th>
                <th className="px-3 py-2 font-medium">Deleted</th>
                <th className="px-3 py-2 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-foreground/90">
              {state.runs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-caption">
                    {formatStarted(r.startedAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top">
                    <StatusBadge run={r} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-caption text-muted-foreground">
                    {r.trigger}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-caption">
                    {r.scanned ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-caption">
                    {r.deleted ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 align-top text-caption text-muted-foreground">
                    {formatDuration(r.startedAt, r.finishedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ run }: { run: CleanupRunSummary }) {
  const status = run.status ?? 'unknown';
  if (status === 'completed') {
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-caption text-emerald-700">
        completed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span
        className="inline-flex items-center rounded-md border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-caption text-destructive"
        title={run.error ?? ''}
      >
        failed
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="inline-flex items-center rounded-md border border-brand-500/40 bg-brand-100 px-2 py-0.5 text-caption text-brand-700 dark:bg-brand-900 dark:text-brand-300">
        running
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-caption text-muted-foreground">
      {status}
    </span>
  );
}

function formatStarted(iso: string): string {
  try {
    return `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  } catch {
    return iso;
  }
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return '< 1s';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  return `${min}m ${sec % 60}s`;
}
