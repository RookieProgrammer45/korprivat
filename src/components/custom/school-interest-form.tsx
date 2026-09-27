//
// Organizations / school portal do not exist yet. This page captures email +
// school name + city via the existing POST /api/waitlist contract
// (name = "School Name · City", role = INSTRUCTOR).

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/forms';
import { WaitlistCreated } from '@/lib/waitlist/schema';

const SchoolInterestSchema = z.object({
  email: z.string().trim().email(),
  schoolName: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
});

type SchoolInterestValues = z.infer<typeof SchoolInterestSchema>;

export function SchoolInterestForm() {
  const t = useTranslations('forSkolor.form');
  const [done, setDone] = useState(false);

  const form = useForm<SchoolInterestValues>({
    resolver: zodResolver(SchoolInterestSchema),
    mode: 'onBlur',
    defaultValues: { email: '', schoolName: '', city: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      // Existing waitlist API: name + email + role only (no city column yet).
      await apiFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify({
          name: `${values.schoolName} · ${values.city}`,
          email: values.email,
          role: 'INSTRUCTOR',
        }),
        schema: WaitlistCreated,
      });
      setDone(true);
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) {
        form.setError('email', { message: t('genericError') });
      }
    }
  });

  if (done) {
    return (
      <p className="rounded-xl border border-brand-500/30 bg-brand-50/80 px-4 py-3 text-body text-foreground dark:bg-brand-950/40">
        {t('success')}
      </p>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        <FormField
          control={form.control}
          name="schoolName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('schoolNameLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="organization"
                  placeholder={t('schoolNamePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('cityLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="address-level2"
                  placeholder={t('cityPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={t('emailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}
