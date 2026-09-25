// @polsia:user-owned — global GDPR cookie / consent banner.
//
// Three actions: accept all / reject non-essential / customize (granular
// toggles). On every decision, POSTs /api/consent via apiFetch. The server
// stamps a one-way `subjectHash` (SHA-256 of IP + UA + a random salt) so
// retries from the same visitor group without a PII-bearing identity row.
//
// Hydration safety:
//   The first render starts at `display: none` so SSR never flashes banner
//   to a returning visitor. A single useEffect decides the visible state
//   after mount. localStorage is read ONLY inside the effect — never on
//   the server.
//
// Storage:
//   Mirrored into localStorage AND into the server's `dl_consent_v1` cookie
//   (set by /api/consent). localStorage is the fast-path rehydration when
//   the banner remounts on client-side route changes; the cookie is what
//   the server's GET /api/consent reads to re-display banner state without
//   trusting the client carry-over.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiFetch } from '@/lib/api-client';
import type { ConsentDecisionScope } from '@/lib/contracts/consent';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/privacy';

const STORAGE_KEY = 'consent_v1';

type Stored = {
  policyVersion: string;
  scope: { essential: true; analytics: boolean; marketing: boolean };
};

function readStored(): Stored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.policyVersion === 'string' &&
      parsed.scope &&
      parsed.scope.essential === true
    ) {
      return parsed as Stored;
    }
    return null;
  } catch {
    return null;
  }
}

function writeStored(scope: ConsentDecisionScope): void {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ policyVersion: PRIVACY_POLICY_VERSION, scope }),
    );
  } catch {
    // localStorage may be blocked (private mode, quota) — the cookie still
    // exists, so next visit still resolves to "decided".
  }
}

async function postDecision(
  scope: ConsentDecisionScope,
  source: 'banner' | 'signup' | 'license-upload',
) {
  await apiFetch('/api/consent', {
    method: 'POST',
    body: JSON.stringify({
      policyVersion: PRIVACY_POLICY_VERSION,
      scope,
      source,
    }),
  });
}

export function ConsentBanner() {
  const t = useTranslations('consentBanner');
  const [mounted, setMounted] = useState(false);
  const [decided, setDecided] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = readStored();
    if (stored?.policyVersion === PRIVACY_POLICY_VERSION) {
      setDecided(true);
      return;
    }
    setDecided(false);
  }, []);

  const submit = useCallback(
    async (next: { analytics: boolean; marketing: boolean }) => {
      setSaving(true);
      try {
        const scope = {
          essential: true as const,
          analytics: next.analytics,
          marketing: next.marketing,
        };
        await postDecision(scope, 'banner');
        writeStored(scope);
        setDecided(true);
        setExpanded(false);
      } catch {
        toast.error(t('error'));
      } finally {
        setSaving(false);
      }
    },
    [t],
  );

  if (!mounted) {
    return null;
  }
  if (decided) {
    return null;
  }

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background px-4 py-3 shadow-lg"
      role="dialog"
      aria-label={t('intro')}
    >
      <div className="container-page mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex-1 text-small text-foreground">
          <p className="leading-relaxed">{t('intro')}</p>
          <p className="mt-1 text-caption text-muted-foreground">
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              {t('privacy')}
            </Link>
          </p>
        </div>
        <div className="dl-action-group sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => void submit({ analytics: false, marketing: false })}
          >
            {t('rejectNonEssential')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => setExpanded((v) => !v)}
          >
            {t('customize')}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void submit({ analytics: true, marketing: true })}
            className="shadow-sm"
          >
            {t('acceptAll')}
          </Button>
        </div>
      </div>
      {expanded ? (
        <div className="container-page mx-auto mt-3 grid max-w-5xl gap-2 rounded-md border border-border bg-card p-3 text-small">
          <ToggleRow
            id="consent-essential"
            label={t('essentialLabel')}
            body={t('essentialBody')}
            checked
            disabled
          />
          <ToggleRow
            id="consent-analytics"
            label={t('analyticsLabel')}
            body={t('analyticsBody')}
            checked={analytics}
            onChange={setAnalytics}
          />
          <ToggleRow
            id="consent-marketing"
            label={t('marketingLabel')}
            body={t('marketingBody')}
            checked={marketing}
            onChange={setMarketing}
          />
          <div className="dl-action-group justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={saving}
              onClick={() => void submit({ analytics, marketing })}
            >
              {t('save')}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  body,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  body: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(v) => onChange?.(v === true)}
        className="mt-0.5"
      />
      <span className="flex flex-col">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-caption text-muted-foreground">{body}</span>
      </span>
    </label>
  );
}
