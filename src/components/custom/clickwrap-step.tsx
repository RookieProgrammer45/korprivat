//
// Pure client island: receives copy + identity-free props from the parent
// sign-up-form, holds `attested` state, and surfaces the controlled submit
// through `onSubmit`. The parent owns the apiFetch and the post-success
// redirect (so the same component can be reused for the dashboard
// renewal card).
//
// The "scroll-read the terms" affordance is the heart of the clickwrap:
// the terms `<div>` is `max-h-72 overflow-y-auto` so the user is forced
// to actively scroll through every paragraph before the checkbox is
// even visually reachable. That mirrors a marketplace host-onboarding
// pattern (active, dated acceptance — not a passive footer disclaimer).
//
// No DB / fetch / server-only imports from this file — strict client island.

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export interface ClickwrapStepCopy {
  title: string;
  lead?: string;
  // e.g. "Terms version v1.0.0" — the version constant is interpolated
  // by the parent (role-version-aware).
  versionEyebrow: string;
  // The terms body — at least one paragraph; founder will replace text.
  bodyParagraphs: string[];
  checkboxLabel: string;
  submit: string;
  submitting: string;
  back: string;
  errors: {
    attestationRequired: string;
    submitFailed: string;
  };
}

export interface ClickwrapStepProps {
  copy: ClickwrapStepCopy;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}

export function ClickwrapStep({ copy, submitting, onSubmit, onBack }: ClickwrapStepProps) {
  const [attested, setAttested] = useState(false);

  const handleSubmit = () => {
    if (!attested) return;
    onSubmit();
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{copy.versionEyebrow}</p>
        <p className="text-h4 text-foreground">{copy.title}</p>
        {copy.lead ? <p className="text-body text-muted-foreground">{copy.lead}</p> : null}
      </div>
      <div className="max-h-72 overflow-y-auto rounded-md border border-border bg-card p-4 shadow-inner">
        <div className="grid gap-3 text-small leading-relaxed text-foreground">
          {copy.bodyParagraphs.map((line) => (
            <p key={`${copy.versionEyebrow}-${line}`}>{line}</p>
          ))}
        </div>
      </div>
      <label
        htmlFor="clickwrap-attestation"
        className="flex cursor-pointer items-start gap-2 rounded-md border border-input bg-card px-3 py-2.5 text-small"
      >
        <Checkbox
          id="clickwrap-attestation"
          checked={attested}
          onCheckedChange={(checked) => setAttested(checked === true)}
          className="mt-0.5"
        />
        <span className="flex flex-col">
          <span className="text-foreground">{copy.checkboxLabel}</span>
        </span>
      </label>
      <div className="dl-action-group flex-col sm:flex-row sm:justify-between">
        <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
          {copy.back}
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!attested || submitting}
          className="shadow-sm"
        >
          {submitting ? copy.submitting : copy.submit}
        </Button>
      </div>
    </div>
  );
}
