//
// Mounted on `/dashboard/handledare` (between the clickwrap badge and the
// "Browse learners" CTA). Reads `GET /api/instructor-license` on mount
// and branches:
//   - canUpgrade === false (STUDENT or INSTRUCTOR profile) → render null
//     so a future cohort can't accidentally surface an upgrade CTA they
//     can't act on.
//   - status NONE / PENDING → show the upload form (or the pending
//     review card while the row sits PENDING).
//   - status VERIFIED + role HANDLEDARE (the user's role before the flip)
//     → auto-POST /api/instructor-license/upgrade and on success refresh
//     so the served shell moves them onto the instructor dashboard. The
//     admin decision endpoint runs the same flip atomically; this is the
//     user-facing catch-up path so a refresh during/after a fresh VERIFIED
//     doesn't strand the user on a closed dashboard.
//   - status REJECTED → render the rejection card with the admin's
//     reason + a re-upload form (same endpoint, same file shape).
//
// All copy via `useTranslations('dashboard.handledare.upgrade')`. The
// form's submit targets `POST /api/instructor-license` directly (the
// existing endpoint, which now 403s STUDENT and admits HANDLEDARE).
//
// On success the wizard already routes to /dashboard/instructor via
// ?signup=1; this island's VERIFIED branch refreshes the *current* page
// (the handledare dashboard) so the layout re-fetches the role and
// decides where to redirect — the user's next navigation will land on
// the instructor dashboard automatically.

'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  InstructorLicenseUpgradeResponse,
  LicenseStatusResponse,
} from '@/lib/contracts/instructor-license';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const ACCEPT_MIME = 'image/*,application/pdf';

type Status = 'NONE' | 'PENDING' | 'VERIFIED' | 'REJECTED';

type LicenseFetchState =
  | {
      kind: 'loading';
    }
  | {
      kind: 'ready';
      status: Status;
      rejectionReason: string | null;
      canUpgrade: boolean;
    }
  | {
      kind: 'error';
    };

type UpgradeFlowState =
  | { kind: 'idle' }
  | { kind: 'upgrading' }
  | { kind: 'upgraded'; alreadyUpgraded: boolean };

export function HandledareUpgradeSection() {
  const t = useTranslations('dashboard.handledare.upgrade');
  const router = useRouter();
  const [state, setState] = useState<LicenseFetchState>({ kind: 'loading' });
  const [upgradeFlow, setUpgradeFlow] = useState<UpgradeFlowState>({ kind: 'idle' });

  useEffect(() => {
    let active = true;
    apiFetch('/api/instructor-license', { schema: LicenseStatusResponse })
      .then((data) => {
        if (!active) return;
        setState({
          kind: 'ready',
          status: data.status,
          rejectionReason: data.rejectionReason ?? null,
          canUpgrade: data.canUpgrade,
        });
      })
      .catch(() => {
        if (!active) return;
        // The endpoint is server-side gated; if it 403'd we'd be a STUDENT
        // and the section would render null anyway. Failures here fall
        // back to "could not load" so the user doesn't see a misleading
        // empty CTA.
        setState({ kind: 'error' });
      });
    return () => {
      active = false;
    };
  }, []);

  // Auto-flip on VERIFIED. The admin endpoint fires the role flip
  // transactionally, but a refresh BEFORE the user revisits the page
  // (e.g. admin approves while this tab is open) leaves the role still
  // HANDLEDARE in the layout's read; this call catches up.
  useEffect(() => {
    if (state.kind !== 'ready' || !state.canUpgrade) return;
    if (state.status !== 'VERIFIED') return;
    if (upgradeFlow.kind !== 'idle') return;
    let active = true;
    setUpgradeFlow({ kind: 'upgrading' });
    apiFetch('/api/instructor-license/upgrade', {
      method: 'POST',
      body: JSON.stringify({}),
      schema: InstructorLicenseUpgradeResponse,
    })
      .then((resp) => {
        if (!active) return;
        setUpgradeFlow({ kind: 'upgraded', alreadyUpgraded: resp.alreadyUpgraded });
        toast.success(t('autoUpgradeSuccess'));
        router.refresh();
      })
      .catch(() => {
        if (!active) return;
        setUpgradeFlow({ kind: 'idle' });
        toast.error(t('autoUpgradeFailed'));
      });
    return () => {
      active = false;
    };
  }, [state, upgradeFlow.kind, router, t]);

  if (state.kind === 'loading') {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }
  if (state.kind === 'error') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="grid gap-2 p-6">
          <p className="text-eyebrow text-muted-foreground">{t('loadErrorEyebrow')}</p>
          <p className="text-body text-muted-foreground">{t('loadErrorBody')}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => location.reload()}
          >
            {t('retry')}
          </Button>
        </CardContent>
      </Card>
    );
  }
  if (!state.canUpgrade) {
    return null;
  }

  if (state.status === 'VERIFIED') {
    if (upgradeFlow.kind === 'upgraded') {
      return (
        <Card className="surface-card border-brand-500/40 bg-brand-100 dark:bg-brand-900">
          <CardContent className="grid gap-2 p-6">
            <p className="text-eyebrow text-brand-700 dark:text-brand-300">
              {t('verifiedEyebrow')}
            </p>
            <p className="text-h4 text-foreground">{t('verifiedTitle')}</p>
            <p className="max-w-2xl text-body text-muted-foreground">{t('verifiedBody')}</p>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card className="surface-card border-brand-500/40 bg-brand-100 dark:bg-brand-900">
        <CardContent className="grid gap-2 p-6">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('pepEyebrow')}</p>
          <p className="text-h4 text-foreground">{t('pepTitle')}</p>
          <p className="text-small text-muted-foreground">{t('pepBody')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card border-brand-500/30 bg-brand-100 dark:bg-brand-900">
      <CardContent className="grid gap-4 p-6">
        <div className="grid gap-1">
          <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('eyebrow')}</p>
          <p className="text-h4 text-foreground">{t('title')}</p>
          <p className="max-w-2xl text-body text-muted-foreground">{t('lead')}</p>
        </div>
        {state.status === 'PENDING' ? <PendingBody t={t} /> : null}
        {state.status === 'REJECTED' ? <RejectedBody reason={state.rejectionReason} t={t} /> : null}
        {state.status !== 'PENDING' ? <UploadForm tFn={t} /> : null}
      </CardContent>
    </Card>
  );
}

function PendingBody({
  t,
}: {
  t: ReturnType<typeof useTranslations<'dashboard.handledare.upgrade'>>;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-brand-500/40 bg-brand-100 p-4 dark:bg-brand-900">
      <p className="text-eyebrow text-brand-700 dark:text-brand-300">{t('pendingEyebrow')}</p>
      <p className="text-body text-foreground">{t('pendingBody')}</p>
    </div>
  );
}

function RejectedBody({
  reason,
  t,
}: {
  reason: string | null;
  t: ReturnType<typeof useTranslations<'dashboard.handledare.upgrade'>>;
}) {
  return (
    <div className="grid gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-4">
      <p className="text-eyebrow text-destructive">{t('rejectedEyebrow')}</p>
      <p className="text-body text-foreground">{t('rejectedBody')}</p>
      {reason ? <p className="text-small text-muted-foreground">{reason}</p> : null}
    </div>
  );
}

function UploadForm({
  tFn,
}: {
  tFn: ReturnType<typeof useTranslations<'dashboard.handledare.upgrade'>>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const accepted = file ? licenseAccepted(file) : null;
  const canSubmit = !!file && accepted === 'ok' && attested && !submitting;

  async function submit() {
    if (!file || accepted !== 'ok' || !attested) return;
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('license', file, file.name || 'license');
      fd.append('attestation', 'true');
      const response = await fetch('/api/instructor-license', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      if (!response.ok) throw new Error('license upload failed');
      // Refetch the status on the parent island by reloading — the GET
      // projection flips to PENDING and the section re-renders the
      // pending body.
      location.reload();
    } catch {
      toast.error(tFn('formErrors.uploadFailed'));
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <Label htmlFor="handledare-upgrade-license">{tFn('form.fileLabel')}</Label>
        <p className="text-caption text-muted-foreground">{tFn('form.fileHelp')}</p>
        <Input
          id="handledare-upgrade-license"
          type="file"
          accept={ACCEPT_MIME}
          className="cursor-pointer file:mr-3 file:cursor-pointer"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-caption text-muted-foreground">
          {file ? selectedFileLine(file) : tFn('form.fileSelectedNone')}
        </p>
        {file && accepted === 'wrongType' ? (
          <p className="text-caption text-destructive">{tFn('form.fileWrongType')}</p>
        ) : null}
        {file && accepted === 'tooLarge' ? (
          <p className="text-caption text-destructive">{tFn('form.fileTooLarge')}</p>
        ) : null}
      </div>
      <label
        htmlFor="handledare-upgrade-attestation"
        className="flex cursor-pointer items-start gap-2 rounded-md border border-input bg-card px-3 py-2.5 text-small"
      >
        <Checkbox
          id="handledare-upgrade-attestation"
          checked={attested}
          onCheckedChange={(checked) => setAttested(checked === true)}
          className="mt-0.5"
        />
        <span className="font-medium text-foreground">{tFn('form.attestationLabel')}</span>
      </label>
      <div className="flex">
        <Button type="button" onClick={submit} disabled={!canSubmit} className="ml-auto shadow-sm">
          {submitting ? tFn('form.submitting') : tFn('form.submit')}
        </Button>
      </div>
    </div>
  );
}

function licenseAccepted(file: File): 'ok' | 'wrongType' | 'tooLarge' {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) return 'tooLarge';
    return 'ok';
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) return 'tooLarge';
    return 'ok';
  }
  return 'wrongType';
}

function selectedFileLine(file: File): string {
  const kb = Math.max(1, Math.round(file.size / 1024));
  return `${file.name} · ${kb} KB`;
}
