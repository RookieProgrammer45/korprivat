'use client';

// @polsia:user-owned — Didit KYC verify trigger (web SDK modal).
// Consent copy is required before opening the hosted verification URL.
// onComplete is a UI hint only — the webhook is the source of truth.

import { DiditSdk } from '@didit-protocol/sdk-web';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

type VerifyPhase = 'idle' | 'loading' | 'open' | 'done' | 'error';

export type DiditVerifyResult = {
  type: string;
};

export function DiditVerifyButton({
  className,
  onComplete,
  onCancelled,
  onOpened,
  translationNamespace = 'dashboard.student.verifyBanner',
  ctaLabel,
  startingLabel,
}: {
  className?: string;
  onComplete?: (result: DiditVerifyResult) => void;
  onCancelled?: () => void;
  onOpened?: () => void;
  translationNamespace?: 'dashboard.student.verifyBanner' | 'onboarding.verify';
  ctaLabel?: string;
  startingLabel?: string;
}) {
  const t = useTranslations(translationNamespace);
  const [phase, setPhase] = useState<VerifyPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [consented, setConsented] = useState(false);

  async function start() {
    if (!consented) {
      setError(t('consentRequired'));
      return;
    }
    setError(null);
    setPhase('loading');
    try {
      const res = await fetch('/api/verify', { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        state?: string;
      };
      if (!res.ok || !body.url) {
        setPhase('error');
        setError(body.error === 'invalid_state' ? t('invalidState') : t('startFailed'));
        return;
      }

      DiditSdk.shared.onComplete = (result) => {
        // UI hint only — webhook writes dateOfBirthVerified.
        if (result.type === 'cancelled') {
          setPhase('idle');
          onCancelled?.();
          return;
        }
        setPhase('done');
        onComplete?.(result);
      };
      void DiditSdk.shared
        .startVerification({ url: body.url })
        .then(() => {
          setPhase('open');
          onOpened?.();
        })
        .catch((err) => {
          console.error('Didit SDK failed to open', err);
          setPhase('error');
          setError(t('startFailed'));
        });
      setPhase('open');
      onOpened?.();
    } catch (err) {
      console.error('Didit verify start failed', err);
      setPhase('error');
      setError(t('startFailed'));
    }
  }

  return (
    <div className={className ? `grid gap-3 ${className}` : 'grid gap-3'}>
      <label className="flex items-start gap-2 text-pretty text-small text-muted-foreground">
        <input
          type="checkbox"
          className="mt-1 size-4 shrink-0 rounded border-border"
          checked={consented}
          onChange={(e) => {
            setConsented(e.target.checked);
            if (e.target.checked) setError(null);
          }}
        />
        <span>{t('consent')}</span>
      </label>
      <Button
        type="button"
        size="sm"
        disabled={!consented || phase === 'loading' || phase === 'open'}
        onClick={() => void start()}
      >
        {phase === 'loading' ? (startingLabel ?? t('starting')) : (ctaLabel ?? t('cta'))}
      </Button>
      {phase === 'done' && translationNamespace === 'dashboard.student.verifyBanner' ? (
        <p className="text-pretty text-small text-muted-foreground">{t('submitted')}</p>
      ) : null}
      {error ? (
        <p className="text-pretty text-small text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
