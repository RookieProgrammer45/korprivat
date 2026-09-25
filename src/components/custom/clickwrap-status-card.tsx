// @polsia:user-owned — handledare dashboard clickwrap status card.
//
// Tiny client island the handledare dashboard mounts after the server
// guard confirms `isCurrent === true`. Fetches GET /api/clickwrap so the
// "You've accepted terms v.X.Y.Z" badge is data-driven (instead of being
// hardcoded behind the guard) and stays zod-validated end-to-end. The
// page body never has the row in scope, per the data-plane rule.
//
// Three render states:
//   1. loading — a small skeleton.
//   2. accepted — eyebrow (version-bumped) + intro title/body + a brand-
//      tinted badge; the badge text is the versionEyebrow copy (so
//      bumping the constant makes the badge reflect the new deploy).
//   3. error / null — the guard already gated this surface so the row
//      SHOULD exist; an error/null state falls back to the same eyebrow
//      with a "Accepted (terms unavailable)" message instead of crashing
//      the page.

'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { CurrentAcceptance } from '@/lib/contracts/clickwrap';

export interface ClickwrapStatusCardCopy {
  badge: string;
  introTitle: string;
  introBody: string;
}

type LoadState = { kind: 'loading' } | { kind: 'ready'; version: string } | { kind: 'stale' };

export function ClickwrapStatusCard({ copy }: { copy: ClickwrapStatusCardCopy }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/clickwrap', { schema: CurrentAcceptance.nullable() })
      .then((data) => {
        if (!active) return;
        if (data === null) {
          setState({ kind: 'stale' });
          return;
        }
        setState({ kind: 'ready', version: data.termsVersion });
      })
      .catch(() => {
        if (!active) return;
        setState({ kind: 'stale' });
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.kind === 'loading') {
    return (
      <Card className="border-border bg-card">
        <CardContent className="h-16 animate-pulse p-5" />
      </Card>
    );
  }

  // Bump-to-current: show the row's actual version rather than the
  // always-deployment-current copy (so the handle stay honest about which
  // version they accepted). On error/null, fall back to the static badge.
  const eyebrow = state.kind === 'ready' ? `${copy.badge} · ${state.version}` : copy.badge;

  return (
    <Card className="border-brand-500/40 bg-brand-100 dark:bg-brand-900">
      <CardContent className="grid gap-1 p-5">
        <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
        <p className="font-display text-h4 font-semibold text-foreground">{copy.introTitle}</p>
        <p className="text-small text-muted-foreground">{copy.introBody}</p>
      </CardContent>
    </Card>
  );
}
