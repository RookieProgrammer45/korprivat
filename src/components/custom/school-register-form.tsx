'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api-client';
import { OrgRegisterResponse } from '@/lib/contracts/orgs';
import { applyServerErrors } from '@/lib/forms';

const SchoolRegisterSchema = z.object({
  name: z.string().trim().min(2).max(120),
  organizationNumber: z.string().trim().min(1).max(32),
  city: z.string().trim().min(1).max(80),
  address: z.string().trim().max(200).optional().or(z.literal('')),
  postcode: z.string().trim().max(20).optional().or(z.literal('')),
});

type SchoolRegisterValues = z.infer<typeof SchoolRegisterSchema>;

export function SchoolRegisterForm() {
  const t = useTranslations('forSkolor');
  const router = useRouter();
  const [duplicate, setDuplicate] = useState(false);

  const form = useForm<SchoolRegisterValues>({
    resolver: zodResolver(SchoolRegisterSchema),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      organizationNumber: '',
      city: '',
      address: '',
      postcode: '',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setDuplicate(false);
    try {
      await apiFetch('/api/orgs/register', {
        method: 'POST',
        body: JSON.stringify({
          name: values.name,
          organizationNumber: values.organizationNumber,
          city: values.city,
          address: values.address?.trim() || undefined,
          postcode: values.postcode?.trim() || undefined,
        }),
        schema: OrgRegisterResponse,
      });
      router.push('/dashboard/school');
      router.refresh();
    } catch (err) {
      const cause =
        err instanceof Error && err.cause && typeof err.cause === 'object'
          ? (err.cause as { error?: string; errors?: Record<string, string> })
          : null;
      if (cause?.error === 'org_exists') {
        setDuplicate(true);
        return;
      }
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) {
        form.setError('name', { message: t('form.genericError') });
      }
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="grid gap-4" noValidate>
        {duplicate ? (
          <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-small text-destructive">
            {t('form.errorDuplicate')}
          </p>
        ) : null}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.name')}</FormLabel>
              <FormControl>
                <Input autoComplete="organization" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="organizationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.organizationNumber')}</FormLabel>
              <FormControl>
                <Input className="h-12" inputMode="numeric" {...field} />
              </FormControl>
              <FormDescription>{t('form.organizationNumberHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.city')}</FormLabel>
              <FormControl>
                <Input autoComplete="address-level2" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.address')}</FormLabel>
              <FormControl>
                <Input autoComplete="street-address" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="postcode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('form.postcode')}</FormLabel>
              <FormControl>
                <Input autoComplete="postal-code" className="h-12" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="w-full">
          {form.formState.isSubmitting ? t('form.submitting') : t('form.submit')}
        </Button>
      </form>
    </Form>
  );
}
