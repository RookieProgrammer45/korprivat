'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { resetPassword } from '@/lib/auth-client';
import { loginHrefWithNext } from '@/lib/auth-next';

type FormValues = { password: string; confirm: string };

export function ResetPasswordForm({ token, next }: { token: string; next?: string }) {
  const router = useRouter();
  const t = useTranslations('auth.resetPassword');

  const form = useForm<FormValues>({
    defaultValues: { password: '', confirm: '' },
    mode: 'onTouched',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    if (values.password.length < 8) {
      form.setError('password', { message: t('errors.tooShort') });
      return;
    }
    if (values.password !== values.confirm) {
      form.setError('confirm', { message: t('errors.mismatch') });
      return;
    }

    try {
      const { error } = await resetPassword({
        newPassword: values.password,
        token,
      });
      if (error) {
        toast.error(t('errors.invalidToken'));
        return;
      }
      toast.success(t('success'));
      router.push(loginHrefWithNext(next));
      router.refresh();
    } catch {
      // Transport failures do not navigate away from the recovery form.
      toast.error(t('errors.generic'));
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="auth-form grid gap-5" noValidate>
        <FormField
          control={form.control}
          name="password"
          rules={{ required: true, minLength: 8 }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.passwordLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="auth-input h-12"
                  placeholder={t('fields.passwordPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirm"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.confirmLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  className="auth-input h-12"
                  placeholder={t('fields.confirmPlaceholder')}
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
        <p className="text-center text-small text-muted-foreground">
          <Link
            href={loginHrefWithNext(next)}
            className="font-medium text-brand-600 underline-offset-2 hover:underline dark:text-brand-400"
          >
            {t('backToLogin')}
          </Link>
        </p>
      </form>
    </Form>
  );
}
