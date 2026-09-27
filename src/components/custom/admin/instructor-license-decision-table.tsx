//
// Fetches /api/admin/instructor-license-decisions on mount (last 200
// pending rows; FIFO by submittedAt) and renders a table where admin can
// approve or reject each row inline. Approving POSTs to
// /api/admin/instructor-license-decision with `{status: 'VERIFIED'}`;
// rejecting opens an inline editor for the rejection reason.
//
// All admin gates live in the route handlers; the island just calls
// /api/admin/... and renders loading/empty/error per the
// nextjs-data-plane skill.

'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import {
  InstructorLicenseAdminDecision,
  InstructorLicenseAdminList,
  type InstructorLicenseAdminRow,
} from '@/lib/contracts/instructor-license';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'ready'; items: InstructorLicenseAdminRow[]; pendingUserId: string | null };

export function InstructorLicenseDecisionTable() {
  const t = useTranslations('dashboard.admin.instructorLicenses');
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch('/api/admin/instructor-license-decisions', {
          schema: InstructorLicenseAdminList,
        });
        if (!cancelled) setState({ kind: 'ready', items: data.items, pendingUserId: null });
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
      <Card className="border-border bg-card">
        <CardContent className="grid gap-2 p-6">
          <p className="text-body text-foreground">{t('loadError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      {state.items.length === 0 ? (
        <p className="p-6 text-body text-muted-foreground">{t('empty')}</p>
      ) : (
        <table className="min-w-full divide-y divide-border text-small">
          <thead className="bg-card text-left text-eyebrow text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">{t('columns.user')}</th>
              <th className="px-3 py-2 font-medium">{t('columns.submittedAt')}</th>
              <th className="px-3 py-2 font-medium">{t('columns.file')}</th>
              <th className="px-3 py-2 font-medium text-right">{t('columns.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-foreground/90">
            {state.items.map((row) => (
              <DecisionRow
                key={row.userId}
                row={row}
                pendingUserId={state.pendingUserId}
                onPending={(userId) =>
                  setState({ kind: 'ready', items: state.items, pendingUserId: userId })
                }
                onDecided={(userId) => {
                  setState({
                    kind: 'ready',
                    items: state.items.filter((r) => r.userId !== userId),
                    pendingUserId: null,
                  });
                }}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DecisionRow({
  row,
  pendingUserId,
  onPending,
  onDecided,
}: {
  row: InstructorLicenseAdminRow;
  pendingUserId: string | null;
  onPending: (userId: string | null) => void;
  onDecided: (userId: string) => void;
}) {
  const t = useTranslations('dashboard.admin.instructorLicenses');
  const [rejectReason, setRejectReason] = useState('');

  const submitting = pendingUserId === row.userId;

  async function approve() {
    const body = InstructorLicenseAdminDecision.parse({
      userId: row.userId,
      status: 'VERIFIED',
    });
    onPending(row.userId);
    try {
      await apiFetch('/api/admin/instructor-license-decision', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success(t('toasts.approveSuccess'));
      onDecided(row.userId);
    } catch {
      toast.error(t('toasts.approveFailed'));
      onPending(null);
    }
  }

  async function reject() {
    const reasonTrim = rejectReason.trim();
    if (!reasonTrim) {
      toast.error(t('toasts.rejectionRequired'));
      return;
    }
    const body = InstructorLicenseAdminDecision.parse({
      userId: row.userId,
      status: 'REJECTED',
      rejectionReason: reasonTrim,
    });
    onPending(row.userId);
    try {
      await apiFetch('/api/admin/instructor-license-decision', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast.success(t('toasts.rejectSuccess'));
      onDecided(row.userId);
    } catch {
      toast.error(t('toasts.rejectFailed'));
      onPending(null);
    }
  }

  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <span className="font-medium text-foreground">{row.name}</span>
        <span className="ml-1 text-caption text-muted-foreground">({row.email})</span>
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-caption text-muted-foreground">
        {formatDate(row.submittedAt)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 align-top">
        <a
          href={row.fileUrl}
          target="_blank"
          rel="noopener"
          className="text-small text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
        >
          {row.fileMime} · {kb(row.fileSizeBytes)}
        </a>
      </td>
      <td className="px-3 py-2 align-top">
        <div className="flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={submitting}
              onClick={approve}
            >
              {t('actions.verifyShort')}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={reject}
            >
              {t('actions.rejectShort')}
            </Button>
          </div>
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder={t('dialog.rejectReasonPlaceholder')}
            className="w-full max-w-md rounded-md border border-input bg-background px-2 py-1 text-caption outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={t('dialog.rejectReasonLabel')}
          />
        </div>
      </td>
    </tr>
  );
}

function kb(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  try {
    return `${new Date(iso).toISOString().replace('T', ' ').slice(0, 16)} UTC`;
  } catch {
    return iso;
  }
}
