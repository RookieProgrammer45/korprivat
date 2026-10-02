'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { requestPasswordReset } from '@/lib/auth-client';

type FormValues = { email: string };

/**
 * Requests a password-reset email via better-auth.
 * Always shows the same success state (enumeration-safe).
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const [sent, setSent] = useState(false);

  const form = useForm<FormValues>({
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const email = values.email.trim();
    // redirectTo is optional — our sendResetPassword builds a branded URL with
    // the token directly. Passing same-origin keeps originCheck happy if set.
    const { error } = await requestPasswordReset({
      email,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      toast.error(t('errors.generic'));
      return;
    }
    setSent(true);
  });

  if (sent) {
    return (
      <div className="grid gap-4">
        <p className="text-pretty text-body text-muted-foreground">{t('sentBody')}</p>
        <Button asChild variant="outline" size="lg" className="h-12 w-full">
          <Link href="/login">{t('backToLogin')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="auth-form grid gap-5" noValidate>
        <FormField
          control={form.control}
          name="email"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  className="auth-input h-12"
                  placeholder={t('fields.emailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting}
          className="auth-submit mt-1 h-12 w-full text-base shadow-sm"
        >
          {form.formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}
