'use client';
//
// Seller-side CRUD for marketplace offerings (intensive courses / packages).
// Mounted on the instructor dashboard; loads /api/instructors/me/offerings
// and mutates through the same REST data plane as every other dashboard
// island. Mobile-safe: every row is flex-wrap with min-w-0 so nothing gets
// squeezed on phones.
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type OfferingKind,
  type OwnOffering,
  OfferingDeleted,
  OfferingUpserted,
  OwnOfferingList,
} from '@/lib/contracts/offerings';

type Draft = {
  kind: OfferingKind;
  name: string;
  priceSek: string;
  sessions: string;
  weeks: string;
  description: string;
  active: boolean;
};

const EMPTY_DRAFT: Draft = {
  kind: 'INTENSIVKURS',
  name: '',
  priceSek: '',
  sessions: '',
  weeks: '',
  description: '',
  active: true,
};

type Status =
  | { kind: 'loading' }
  | { kind: 'no-listing' }
  | { kind: 'ready'; items: OwnOffering[] };

const NO_LISTING_ERROR = 'No instructor row for this account';

export function InstructorOfferingsEditor() {
  const tr = useTranslations('offerings.editor');
  const trKind = useTranslations('offerings.editor.kind');
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch('/api/instructors/me/offerings', {
        schema: OwnOfferingList,
      });
      setStatus({ kind: 'ready', items: data.items });
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      const idError =
        cause && typeof cause === 'object' && 'errors' in cause
          ? (cause as { errors?: { id?: string } }).errors?.id
          : undefined;
      if (idError === NO_LISTING_ERROR) {
        setStatus({ kind: 'no-listing' });
        return;
      }
      setStatus({ kind: 'ready', items: [] });
      toast.error(tr('error'));
    }
  }, [tr]);

  useEffect(() => {
    let active = true;
    void (async () => {
      await load();
      void active;
    })();
    return () => {
      active = false;
    };
  }, [load]);

  function startCreate() {
    setEditing({ id: null, draft: { ...EMPTY_DRAFT } });
  }

  function startEdit(offering: OwnOffering) {
    setEditing({
      id: offering.id,
      draft: {
        kind:
          offering.kind === 'LEKTION'
            ? 'LEKTION'
            : offering.kind === 'INTENSIVKURS'
              ? 'INTENSIVKURS'
              : 'PAKET',
        name: offering.name,
        priceSek: String(offering.priceSek),
        sessions: offering.sessions == null ? '' : String(offering.sessions),
        weeks: offering.weeks == null ? '' : String(offering.weeks),
        description: offering.description ?? '',
        active: offering.active,
      },
    });
  }

  function setDraft<K extends keyof Draft>(key: K, value: Draft[K]) {
    setEditing((prev) => (prev ? { ...prev, draft: { ...prev.draft, [key]: value } } : prev));
  }

  async function save() {
    if (!editing || saving) return;
    if (editing.draft.name.trim() === '' || editing.draft.priceSek.trim() === '') {
      toast.error(tr('requiredMissing'));
      return;
    }
    const price = Number(editing.draft.priceSek);
    const sessions = editing.draft.sessions.trim() === '' ? null : Number(editing.draft.sessions);
    const weeks = editing.draft.weeks.trim() === '' ? null : Number(editing.draft.weeks);
    if (!Number.isFinite(price) || price < 0) {
      toast.error(tr('requiredMissing'));
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({
        kind: editing.draft.kind,
        name: editing.draft.name.trim(),
        description: editing.draft.description.trim() || null,
        priceSek: Math.round(price),
        sessions: sessions != null && Number.isFinite(sessions) ? sessions : null,
        weeks: weeks != null && Number.isFinite(weeks) ? weeks : null,
        active: editing.draft.active,
      });
      if (editing.id) {
        await apiFetch(`/api/instructors/me/offerings/${encodeURIComponent(editing.id)}`, {
          method: 'PATCH',
          schema: OfferingUpserted,
          body,
        });
      } else {
        await apiFetch('/api/instructors/me/offerings', {
          method: 'POST',
          schema: OfferingUpserted,
          body,
        });
      }
      toast.success(tr('saved'));
      setEditing(null);
      await load();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      const errors =
        cause && typeof cause === 'object' && 'errors' in cause
          ? (cause as { errors?: Record<string, string> }).errors
          : undefined;
      const first = errors ? Object.values(errors)[0] : undefined;
      toast.error(first ?? tr('error'));
    } finally {
      setSaving(false);
    }
  }

  async function remove(offering: OwnOffering) {
    if (saving) return;
    if (!window.confirm(tr('deleteConfirm'))) return;
    setSaving(true);
    try {
      await apiFetch(`/api/instructors/me/offerings/${encodeURIComponent(offering.id)}`, {
        method: 'DELETE',
        schema: OfferingDeleted,
      });
      toast.success(tr('deleted'));
      await load();
    } catch {
      toast.error(tr('error'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(offering: OwnOffering, next: boolean) {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch(`/api/instructors/me/offerings/${encodeURIComponent(offering.id)}`, {
        method: 'PATCH',
        schema: OfferingUpserted,
        body: JSON.stringify({ active: next }),
      });
      await load();
    } catch {
      toast.error(tr('error'));
    } finally {
      setSaving(false);
    }
  }

  if (status.kind === 'loading') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="grid gap-3 p-6">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (status.kind === 'no-listing') {
    return (
      <Card className="surface-panel border-border bg-card">
        <CardContent className="p-6">
          <p className="text-small text-muted-foreground">{tr('noListing')}</p>
        </CardContent>
      </Card>
    );
  }

  const items = status.items;

  return (
    <Card className="surface-panel min-w-0 border-border bg-card">
      <CardContent className="grid min-w-0 gap-4 p-6">
        <div className="grid gap-1">
          <h2 className="font-display text-h3 tracking-tight text-foreground">{tr('title')}</h2>
          <p className="text-small text-muted-foreground">{tr('description')}</p>
        </div>

        {items.length === 0 && !editing ? (
          <p className="text-small text-muted-foreground">{tr('empty')}</p>
        ) : null}

        <div className="grid gap-2">
          {items.map((offering) => {
            const kindKey =
              offering.kind === 'LEKTION'
                ? ('LEKTION' as const)
                : offering.kind === 'INTENSIVKURS'
                  ? ('INTENSIVKURS' as const)
                  : ('PAKET' as const);
            const meta: string[] = [];
            if (offering.sessions != null) meta.push(String(offering.sessions));
            return (
              <div
                key={offering.id}
                className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border p-3"
              >
                <div className="flex min-w-0 max-sm:flex-auto items-center gap-3">
                  <Badge variant="secondary" className="shrink-0">
                    {trKind(kindKey)}
                  </Badge>
                  <div className="min-w-0">
                    <p className="truncate text-small font-medium text-foreground">
                      {offering.name}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {[
                        offering.sessions != null
                          ? `${offering.sessions} ${tr('sessionsShort')}`
                          : null,
                        offering.weeks != null ? `${offering.weeks} ${tr('weeksShort')}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <span className="text-small font-medium text-foreground">
                    {tr('priceFrom', { price: offering.priceSek })}
                  </span>
                  <Switch
                    checked={offering.active}
                    onCheckedChange={(checked) => void toggleActive(offering, checked)}
                    aria-label={tr('fields.active')}
                  />
                  <Button variant="outline" size="sm" onClick={() => startEdit(offering)}>
                    {tr('editCta')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => void remove(offering)}>
                    {tr('deleteCta')}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {editing ? (
          <div className="grid min-w-0 gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="grid min-w-0 gap-1.5">
                <Label>{tr('fields.kind')}</Label>
                <Select
                  value={editing.draft.kind}
                  onValueChange={(value) => setDraft('kind', value as OfferingKind)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INTENSIVKURS">{trKind('INTENSIVKURS')}</SelectItem>
                    <SelectItem value="PAKET">{trKind('PAKET')}</SelectItem>
                    <SelectItem value="LEKTION">{trKind('LEKTION')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="offering-editor-name">{tr('fields.name')}</Label>
                <Input
                  id="offering-editor-name"
                  value={editing.draft.name}
                  onChange={(e) => setDraft('name', e.target.value)}
                  placeholder={tr('fields.namePlaceholder')}
                  maxLength={120}
                />
              </div>
              <div className="grid min-w-0 gap-1.5">
                <Label htmlFor="offering-editor-price">{tr('fields.price')}</Label>
                <Input
                  id="offering-editor-price"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={editing.draft.priceSek}
                  onChange={(e) => setDraft('priceSek', e.target.value)}
                  placeholder={tr('fields.pricePlaceholder')}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="offering-editor-sessions">{tr('fields.sessions')}</Label>
                  <Input
                    id="offering-editor-sessions"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={editing.draft.sessions}
                    onChange={(e) => setDraft('sessions', e.target.value)}
                    placeholder={tr('fields.sessionsPlaceholder')}
                  />
                </div>
                <div className="grid min-w-0 gap-1.5">
                  <Label htmlFor="offering-editor-weeks">{tr('fields.weeks')}</Label>
                  <Input
                    id="offering-editor-weeks"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={editing.draft.weeks}
                    onChange={(e) => setDraft('weeks', e.target.value)}
                    placeholder={tr('fields.weeksPlaceholder')}
                  />
                </div>
              </div>
            </div>
            <div className="grid min-w-0 gap-1.5">
              <Label htmlFor="offering-editor-description">{tr('fields.description')}</Label>
              <Textarea
                id="offering-editor-description"
                value={editing.draft.description}
                onChange={(e) => setDraft('description', e.target.value)}
                placeholder={tr('fields.descriptionPlaceholder')}
                rows={3}
                maxLength={800}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="offering-editor-active" className="text-small">
                {tr('fields.active')}
              </Label>
              <Switch
                id="offering-editor-active"
                checked={editing.draft.active}
                onCheckedChange={(checked) => setDraft('active', checked)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void save()} disabled={saving}>
                {saving ? tr('saving') : tr('save')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(null)}
                disabled={saving}
              >
                {tr('cancel')}
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <Button variant="secondary" size="sm" onClick={startCreate}>
              {tr('addCta')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
