'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DiditVerifyButton } from '@/components/custom/verification/didit-verify-button';
import { Button } from '@/components/ui/button';
import { SignupState } from '@/lib/contracts/signup';
import { stateToRoute, type LearnerVerificationState } from '@/lib/verification/state';

const POLL_MS = 3000;
const POLL_MAX_MS = 90_000;

const TERMINAL_FOR_REDIRECT = new Set<LearnerVerificationState>([
  'ACTIVE',
  'HANDLEDARE_PENDING',
  'HANDLEDARE_EXPIRED',
  'DIDIT_FAILED',
  'BLOCKED_UNDERAGE',
  'MANUAL_REVIEW',
  'SUSPENDED',
]);

type UiMode = 'start' | 'waiting' | 'in_progress' | 'polling' | 'timeout' | 'error';

export function LearnerVerifyClient({
  initialState,
  initialSessionId,
}: {
  initialState: LearnerVerificationState;
  initialSessionId: string | null;
}) {
  const t = useTranslations('onboarding.verify');
  const router = useRouter();
  const [mode, setMode] = useState<UiMode>(() =>
    initialState === 'DIDIT_PENDING' && initialSessionId ? 'waiting' : 'start',
  );
  const [error, setError] = useState<string | null>(null);
  const pollStartedAt = useRef<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollStartedAt.current = null;
  }, []);

  const redirectForState = useCallback(
    (state: LearnerVerificationState) => {
      stopPolling();
      router.replace(stateToRoute(state));
      router.refresh();
    },
    [router, stopPolling],
  );

  const checkState = useCallback(async (): Promise<LearnerVerificationState | null> => {
    try {
      const res = await fetch('/api/signup/state', { credentials: 'include' });
      if (!res.ok) return null;
      const body = SignupState.safeParse(await res.json());
      if (!body.success || !body.data.verificationState) return null;
      return body.data.verificationState;
    } catch {
      return null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    setMode('polling');
    setError(null);
    pollStartedAt.current = Date.now();

    const tick = async () => {
      const state = await checkState();
      if (state && TERMINAL_FOR_REDIRECT.has(state)) {
        redirectForState(state);
        return;
      }
      if (
        pollStartedAt.current &&
        Date.now() - pollStartedAt.current >= POLL_MAX_MS
      ) {
        stopPolling();
        setMode('timeout');
      }
    };

    void tick();
    pollTimer.current = setInterval(() => void tick(), POLL_MS);
  }, [checkState, redirectForState, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const manualRefresh = async () => {
    setError(null);
    const state = await checkState();
    if (!state) {
      setError(t('refreshFailed'));
      return;
    }
    if (TERMINAL_FOR_REDIRECT.has(state) || state === 'ACTIVE') {
      redirectForState(state);
      return;
    }
    if (state === 'DIDIT_PENDING') {
      setMode('waiting');
      return;
    }
    setMode('start');
  };

  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {mode === 'in_progress' || mode === 'polling'
            ? t('inProgressTitle')
            : mode === 'waiting' || mode === 'timeout'
              ? t('waitingTitle')
              : t('heading')}
        </h1>
        <p className="text-pretty text-body text-muted-foreground">
          {mode === 'timeout'
            ? t('timeoutBody')
            : mode === 'waiting' || mode === 'polling' || mode === 'in_progress'
              ? t('waitingBody')
              : t('subtext')}
        </p>
      </div>

      {mode === 'start' || mode === 'error' ? (
        <DiditVerifyButton
          translationNamespace="onboarding.verify"
          ctaLabel={t('startCta')}
          startingLabel={t('starting')}
          onOpened={() => {
            setMode('in_progress');
            setError(null);
          }}
          onCancelled={() => {
            setMode('start');
          }}
          onComplete={() => {
            startPolling();
          }}
        />
      ) : null}

      {mode === 'waiting' || mode === 'timeout' ? (
        <div className="grid gap-3">
          <Button type="button" onClick={() => void manualRefresh()}>
            {t('checkAgain')}
          </Button>
          {mode === 'waiting' ? (
            <Button type="button" variant="outline" onClick={() => setMode('start')}>
              {t('restartCta')}
            </Button>
          ) : null}
        </div>
      ) : null}

      {mode === 'polling' || mode === 'in_progress' ? (
        <p className="text-pretty text-small text-muted-foreground" aria-live="polite">
          {t('pollingHint')}
        </p>
      ) : null}

      {error ? (
        <p className="text-pretty text-small text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
