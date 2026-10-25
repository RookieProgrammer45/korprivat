'use client';

import { useTranslations } from 'next-intl';
import { type FormEvent, useId, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AUTHORIZATION_SCOPES,
  type AuthorizationScope,
} from '@/lib/orgs/school-authorization-policy';
import { emptyScopeDecisionForm, selectedScopesFromForm } from '@/lib/orgs/scope-decision-form';

type Props = {
  listingId: string;
  headSequence: number;
  decisionVersion: number;
  granted: AuthorizationScope[];
};

export function SchoolScopeDecisionForm({
  listingId,
  headSequence,
  decisionVersion,
  granted,
}: Props) {
  const t = useTranslations('dashboardSchool.scopeForm');
  const formId = useId();
  const [selected, setSelected] = useState(emptyScopeDecisionForm);
  const [evidenceRef, setEvidenceRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replay, setReplay] = useState(false);
  const idempotencyKey = useMemo(
    () => `scope-decision-${listingId}-${crypto.randomUUID()}`,
    [listingId],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const scopes = selectedScopesFromForm(selected);
    setSubmitting(true);
    setError(null);
    setReplay(false);
    try {
      const res = await fetch(`/api/listings/${listingId}/authorizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'grant',
          scopes,
          evidenceRef,
          expectedHeadSequence: headSequence,
          decisionVersion: decisionVersion + 1,
          idempotencyKey,
        }),
      });
      const json = (await res.json()) as { replay?: boolean; error?: string | { code?: string } };
      if (!res.ok) {
        const code = typeof json.error === 'string' ? json.error : json.error?.code;
        setError(code === 'no_scopes_selected' ? t('noneSelected') : t('error'));
        return;
      }
      setReplay(Boolean(json.replay));
    } catch {
      setError(t('error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <p className="text-sm text-muted-foreground">{t('lead')}</p>
      {granted.length > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t('history', { scopes: granted.join(', ') })}
        </p>
      ) : null}
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">{t('scopesLegend')}</legend>
        {AUTHORIZATION_SCOPES.map((scope) => {
          const id = `${formId}-${scope}`;
          return (
            <div key={scope} className="flex items-start gap-2">
              <Checkbox
                id={id}
                checked={selected[scope]}
                onCheckedChange={(value) =>
                  setSelected((current) => ({ ...current, [scope]: value === true }))
                }
              />
              <Label htmlFor={id} className="text-sm font-normal">
                {t(`scopes.${scope}`)}
              </Label>
            </div>
          );
        })}
      </fieldset>
      <div className="grid gap-2">
        <Label htmlFor={`${formId}-evidence`}>{t('evidence')}</Label>
        <Input
          id={`${formId}-evidence`}
          value={evidenceRef}
          onChange={(event) => setEvidenceRef(event.target.value)}
          required
        />
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {replay ? <p className="text-sm text-muted-foreground">{t('replayed')}</p> : null}
      <Button type="submit" disabled={submitting}>
        {t('submit')}
      </Button>
    </form>
  );
}
