'use client';
//
// Learner "request to book" form for one offering. Opens inline under the
// offering row on the public profile; submits to the public requests route
// and surfaces server field errors under the matching inputs.
import type { FormEvent } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  OfferingRequestCreated,
  type PublicOffering,
} from '@/lib/contracts/offerings';

type FormState = {
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  preferredStart: string;
  message: string;
};

const EMPTY_FORM: FormState = {
  studentName: '',
  studentEmail: '',
  studentPhone: '',
  preferredStart: '',
  message: '',
};

export function InstructorOfferingsRequestForm({
  instructorId,
  offering,
  onDone,
}: {
  instructorId: string;
  offering: PublicOffering;
  onDone: () => void;
}) {
  const tr = useTranslations('offerings.requestForm');
  const locale = useLocale();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFieldErrors({});
    try {
      await apiFetch(
        `/api/instructors/${encodeURIComponent(instructorId)}/offerings/requests`,
        {
          method: 'POST',
          schema: OfferingRequestCreated,
          body: JSON.stringify({
            offeringId: offering.id,
            studentName: form.studentName,
            studentEmail: form.studentEmail,
            studentPhone: form.studentPhone,
            preferredStart: form.preferredStart || undefined,
            message: form.message || undefined,
            locale: locale === 'en' ? 'en' : 'sv',
          }),
        },
      );
      toast.success(tr('success'));
      setForm(EMPTY_FORM);
      onDone();
    } catch (err) {
      const cause = err instanceof Error ? err.cause : null;
      const errors =
        cause && typeof cause === 'object' && 'errors' in cause
          ? ((cause as { errors?: Record<string, string> }).errors ?? undefined)
          : undefined;
      if (errors) setFieldErrors(errors);
      toast.error(errors?.form ?? tr('error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="grid min-w-0 gap-3 rounded-lg border border-border bg-muted/40 p-4"
    >
      <p className="text-small font-medium text-foreground">{tr('title', { name: offering.name })}</p>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`offering-name-${offering.id}`}>{tr('nameLabel')}</Label>
          <Input
            id={`offering-name-${offering.id}`}
            value={form.studentName}
            onChange={(e) => set('studentName', e.target.value)}
            placeholder={tr('namePlaceholder')}
            required
            maxLength={120}
          />
          {fieldErrors.studentName ? (
            <p className="text-caption text-destructive">{fieldErrors.studentName}</p>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`offering-email-${offering.id}`}>{tr('emailLabel')}</Label>
          <Input
            id={`offering-email-${offering.id}`}
            type="email"
            value={form.studentEmail}
            onChange={(e) => set('studentEmail', e.target.value)}
            placeholder={tr('emailPlaceholder')}
            required
            maxLength={200}
          />
          {fieldErrors.studentEmail ? (
            <p className="text-caption text-destructive">{fieldErrors.studentEmail}</p>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`offering-phone-${offering.id}`}>{tr('phoneLabel')}</Label>
          <Input
            id={`offering-phone-${offering.id}`}
            type="tel"
            value={form.studentPhone}
            onChange={(e) => set('studentPhone', e.target.value)}
            placeholder={tr('phonePlaceholder')}
            required
            maxLength={40}
          />
          {fieldErrors.studentPhone ? (
            <p className="text-caption text-destructive">{fieldErrors.studentPhone}</p>
          ) : null}
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`offering-start-${offering.id}`}>{tr('startLabel')}</Label>
          <Input
            id={`offering-start-${offering.id}`}
            value={form.preferredStart}
            onChange={(e) => set('preferredStart', e.target.value)}
            placeholder={tr('startPlaceholder')}
            maxLength={120}
          />
        </div>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <Label htmlFor={`offering-message-${offering.id}`}>{tr('messageLabel')}</Label>
        <Textarea
          id={`offering-message-${offering.id}`}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder={tr('messagePlaceholder')}
          rows={3}
          maxLength={1000}
        />
        {fieldErrors.message ? (
          <p className="text-caption text-destructive">{fieldErrors.message}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? tr('submitting') : tr('submit')}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone} disabled={submitting}>
          {tr('cancel')}
        </Button>
      </div>
    </form>
  );
}
