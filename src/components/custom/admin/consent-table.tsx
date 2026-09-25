// @polsia:user-owned — admin GDPR/cookie consent audit table.
//
// Client island: fetches /api/admin/consent on mount and renders the last
// 200 consent events with loading / empty / error states per the nextjs-
// data-plane skill. The page wrapper is a Server Component that calls
// requireAdmin() — the island is JUST the table.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { AdminConsentList } from '@/lib/contracts/consent';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; data: AdminConsentList };

export function ConsentTable() {
  const t = useTranslations();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/admin/consent', { schema: AdminConsentList });
        if (!cancelled) setState({ kind: 'ready', data });
      } catch {
        if (!cancelled) setState({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') {
    return <p className="text-body text-muted-foreground">…</p>;
  }
  if (state.kind === 'error') {
    return (
      <div className="grid gap-2">
        <p className="text-body text-foreground">{t('dashboard.student.loadError')}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => location.reload()}>
          {t('dashboard.student.retry')}
        </Button>
      </div>
    );
  }
  if (state.data.items.length === 0) {
    return <p className="text-body text-muted-foreground">—</p>;
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="min-w-full divide-y divide-border text-small">
        <thead className="bg-card text-left text-eyebrow text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Timestamp</th>
            <th className="px-3 py-2 font-medium">Policy</th>
            <th className="px-3 py-2 font-medium">Source</th>
            <th className="px-3 py-2 font-medium">Scope</th>
            <th className="px-3 py-2 font-medium">User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border text-foreground/90">
          {state.data.items.map((row) => (
            <tr key={row.id}>
              <td className="whitespace-nowrap px-3 py-2 align-top text-caption">
                {formatIso(row.acceptedAt)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-caption">
                {row.policyVersion}
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top">
                <SourceTag source={row.source} />
              </td>
              <td className="px-3 py-2 align-top">
                <ScopeBadges scope={row.scope} />
              </td>
              <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-caption text-muted-foreground">
                {row.userId ? `${row.userId.slice(0, 8)}…` : 'anonymous'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SourceTag({ source }: { source: string }) {
  const palette =
    source === 'signup'
      ? 'border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
      : source === 'license-upload'
        ? 'border-brand-500/40 bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
        : 'border-border bg-muted text-muted-foreground';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-caption ${palette}`}
    >
      {source}
    </span>
  );
}

function ScopeBadges({
  scope,
}: {
  scope: { essential: true; analytics: boolean; marketing: boolean };
}) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge kind="essential" on={scope.essential}>
        essential
      </Badge>
      <Badge kind="analytics" on={scope.analytics}>
        analytics
      </Badge>
      <Badge kind="marketing" on={scope.marketing}>
        marketing
      </Badge>
    </div>
  );
}

function Badge({ kind, on, children }: { kind: string; on: boolean; children: React.ReactNode }) {
  const palette = on
    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
    : 'border-border bg-muted text-muted-foreground/60 line-through';
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-caption ${palette}`}
      data-kind={kind}
    >
      {children}
    </span>
  );
}

function formatIso(iso: string): string {
  try {
    return `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  } catch {
    return iso;
  }
}
