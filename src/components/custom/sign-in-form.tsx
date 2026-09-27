'use client';

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
import { signIn } from '@/lib/auth-client';
import { applyServerErrors } from '@/lib/forms';

type FormValues = { email: string; password: string };

// Sign in against the seeded better-auth catch-all. The signin form
// intentionally doesn't know role — better-auth stores STUDENT|INSTRUCTOR
// on a separate UserProfile row (seeded by the user.create.after hook in
// @/lib/auth-config), and the dashboard guard reads it on render. `next`
// keeps a redirect-after-login handshake intact (?next=/dashboard/student).
export function SignInForm({ next }: { next?: string }) {
  const router = useRouter();
  const t = useTranslations('auth.signIn');

  const form = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
    mode: 'onTouched',
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { error } = await signIn.email({
      email: values.email.trim(),
      password: values.password,
    });
    if (error) {
      // Most auth failures surface a 400 with a flat `{ errors: { … } }`
      // body — applyServerErrors honours that contract. If the shape
      // doesn't match, fall back to a localised toast.
      const applied = applyServerErrors(error, form.setError);
      if (!applied) {
        toast.error(t('errors.invalidCredentials'));
      }
      return;
    }
    // Land on /dashboard so the server role router sends learners, schools,
    // and handledare to the correct leaf. Explicit ?next=… still overrides.
    router.push(next ?? '/dashboard');
    router.refresh();
  });

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
        <FormField
          control={form.control}
          name="password"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.passwordLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  className="auth-input h-12"
                  placeholder={t('fields.passwordPlaceholder')}
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
