// @polsia:user-owned — handledare dashboard clickwrap renewal card.
//
// Server-guard `requireHandledareClickwrap()` mounts this client island
// when the user's stored ClickwrapAcceptance row is missing or its
// `termsVersion` no longer matches the deployment's HANDLEDARE_TERMS_VERSION
// (a terms bump after a deploy). The island lets the existing handledare
// re-attest without redoing the full signup — same `<ClickwrapStep/>`
// affordance as the wizard, then `router.refresh()` so the parent Server
// Component re-runs the guard and renders the proper dashboard contents.
//
// Submit flow:
//   1. parent passes copy.
//   2. on success: apiFetch('/api/clickwrap', POST termsVersion) → 204.
//   3. on 204: toast.success, then router.refresh() so the parent rerenders.
//   4. on any error: toast.error(copy.errors.submitFailed), inputs re-enabled.
//
// No DB / fetch / server-only imports from this file — strict client island.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { ClickwrapStep, type ClickwrapStepCopy } from './clickwrap-step';

export interface ClickwrapRenewalCardProps {
  copy: ClickwrapStepCopy;
  // Localised chrome around the same <ClickwrapStep/> block — eyebrow
  // + body lead that frames the re-attestation as a renewal.
  eyebrow: string;
  renewalTitle: string;
  renewalBody: string;
  successToast: string;
}

export function ClickwrapRenewalCard({
  copy,
  eyebrow,
  renewalTitle,
  renewalBody,
  successToast,
}: ClickwrapRenewalCardProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    setSubmitting(true);
    try {
      await apiFetch('/api/clickwrap', {
        method: 'POST',
        body: JSON.stringify({ termsVersion: HANDLEDARE_TERMS_VERSION }),
      });
    } catch {
      toast.error(copy.errors.submitFailed);
      setSubmitting(false);
      return;
    }
    toast.success(successToast);
    setSubmitting(false);
    router.refresh();
  };

  return (
    <section className="grid gap-4">
      <header className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{eyebrow}</p>
        <h2 className="font-display text-h3 leading-tight tracking-tight text-foreground">
          {renewalTitle}
        </h2>
        <p className="max-w-2xl text-body text-muted-foreground">{renewalBody}</p>
      </header>
      <ClickwrapStep
        copy={copy}
        submitting={submitting}
        onSubmit={onSubmit}
        // The renewal card lives ON the dashboard so the "back" button
        // shouldn't unwind step state — there's no onboarding step graph
        // to step backward into. A safe handler reloads the dashboard,
        // matching the dashboard-guard's "bounce" UX.
        onBack={() => router.refresh()}
      />
    </section>
  );
}
