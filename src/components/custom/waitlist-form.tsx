// @polsia:user-owned
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiFetch } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/forms';
import {
  WaitlistCreate,
  WaitlistCreated,
  type WaitlistCreateInput,
  type WaitlistRoleValue,
} from '@/lib/waitlist/schema';

export interface WaitlistFormResult {
  /** Pre-select the role radio on mount (e.g. INSTRUCTOR). User can still flip it. */
  initialRole?: WaitlistRoleValue;
  onSuccess?: () => void;
}

type RoleKey = 'student' | 'instructor';

// Both role codes map to a single lowercase role key used in the catalog.
const ROLE_KEY: Record<WaitlistRoleValue, RoleKey> = {
  STUDENT: 'student',
  INSTRUCTOR: 'instructor',
};

export function WaitlistForm({ initialRole, onSuccess }: WaitlistFormResult = {}) {
  const t = useTranslations('waitlist');
  const tFields = useTranslations('waitlist.fields');
  const tRoles = useTranslations('waitlist.roleOptions');

  const form = useForm<WaitlistCreateInput>({
    resolver: zodResolver(WaitlistCreate, {
      path: [],
      async: false,
      errorMap: makeErrorMap(t),
    }),
    mode: 'onBlur',
    defaultValues: { name: '', email: '', role: (initialRole ?? undefined) as WaitlistRoleValue },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch('/api/waitlist', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: WaitlistCreated,
      });
      toast.success(t('saved'));
      onSuccess?.();
    } catch (err) {
      const localized = localizeWaitlistErrors(err instanceof Error ? err.cause : null, t);
      const applied = err instanceof Error && applyServerErrors(localized, form.setError);
      if (!applied) {
        toast.error(t('validation.generic'));
      }
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{tFields('nameLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  autoComplete="name"
                  placeholder={tFields('namePlaceholder')}
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
              <FormLabel>{tFields('emailLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  autoComplete="email"
                  placeholder={tFields('emailPlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>{tFields('roleLabel')}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  onBlur={field.onBlur}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  {(Object.keys(ROLE_KEY) as WaitlistRoleValue[]).map((value) => {
                    const id = `role-${value.toLowerCase()}`;
                    const key = ROLE_KEY[value];
                    return (
                      <div
                        key={value}
                        className="group relative flex cursor-pointer items-start gap-3 rounded-md border border-input bg-background px-3 py-3 text-sm transition-colors hover:border-brand-500 hover:bg-brand-100 has-[[data-state=checked]]:border-brand-500 has-[[data-state=checked]]:bg-brand-100 dark:hover:bg-brand-900 dark:has-[[data-state=checked]]:bg-brand-900"
                      >
                        <RadioGroupItem
                          id={id}
                          value={value}
                          aria-label={`${tRoles(`${key}.label`)}. ${tRoles(`${key}.hint`)}`}
                          className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&>span]:hidden"
                        />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none flex flex-col gap-0.5"
                        >
                          <span className="font-medium leading-none text-foreground">
                            {tRoles(`${key}.label`)}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {tRoles(`${key}.hint`)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full shadow-sm" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
  );
}

function makeErrorMap<T extends ReturnType<typeof useTranslations<'waitlist'>>>(t: T) {
  return (issue: {
    code: string;
    path: (string | number)[];
    message?: string;
  }): { message: string } => {
    const field = issue.path[0];
    if (field === 'name') {
      if (issue.code === 'too_big') return { message: t('validation.nameTooLong') };
      if (issue.code === 'too_small') return { message: t('validation.nameRequired') };
    }
    if (field === 'email' && (issue.code === 'invalid_string' || issue.code === 'invalid_type')) {
      return { message: t('validation.emailInvalid') };
    }
    if (field === 'role') return { message: t('validation.roleRequired') };
    return { message: issue.message ?? '' };
  };
}

function localizeWaitlistErrors(
  body: unknown,
  t: ReturnType<typeof useTranslations<'waitlist'>>,
): { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!body || typeof body !== 'object' || !('errors' in body)) return { errors };
  const serverErrors = (body as { errors?: unknown }).errors;
  if (!serverErrors || typeof serverErrors !== 'object') return { errors };
  for (const [field, value] of Object.entries(serverErrors)) {
    if (typeof value !== 'string') continue;
    const lower = value.toLowerCase();
    if (field === 'name') {
      errors[field] =
        lower.includes('under') || lower.includes('120')
          ? t('validation.nameTooLong')
          : t('validation.nameRequired');
    } else if (field === 'email' && (lower.includes('valid') || lower.includes('email'))) {
      errors[field] = t('validation.emailInvalid');
    } else if (field === 'role') {
      errors[field] = t('validation.roleRequired');
    }
  }
  return { errors };
}
