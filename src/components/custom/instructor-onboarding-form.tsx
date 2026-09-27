// `useTranslations('instructorOnboarding')`. The page `/instructors/new`
// hosts this island; the flow is a two-step wizard:
//
//   Step 1 — Photo prompt (shared <PhotoPromptStep/>): drag-drop / choose,
//            live preview, uploads to /api/instructors/photo, hands back the
//            R2 URL which we mirror into RHF `photoUrl` before rendering the
//            detail form.
//   Step 2 — Detail form: name / city / categories / rate / email / bio.
//            On submit we POST /api/instructors with `photoUrl` already set
//            to the R2 URL (no second-stage upload here).
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { LICENCE_CATEGORY_CODES } from '@/lib/business/licence-categories';
import {
  type InstructorCreate as FormValues,
  InstructorCreate,
  InstructorCreated,
} from '@/lib/contracts/instructors';
import { SignupState } from '@/lib/contracts/signup';
import { applyServerErrors } from '@/lib/forms';
import { PhotoPromptStep } from './photo-prompt-step';

export function InstructorOnboardingForm({
  providerRole = 'INSTRUCTOR',
}: {
  providerRole?: 'INSTRUCTOR' | 'HANDLEDARE';
}) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('instructorOnboarding');
  const tFields = useTranslations('instructorOnboarding.fields');
  const tPicture = useTranslations('auth.signUp.pictureUpload');

  const form = useForm<FormValues>({
    resolver: zodResolver(InstructorCreate),
    mode: 'onBlur',
    defaultValues: {
      name: '',
      city: '',
      categories: [],
      hourlyRateSek: Number.NaN,
      bio: '',
      serviceArea: '',
      photoUrl: '',
      email: '',
      providerRole,
      locale: locale === 'en' ? 'en' : 'sv',
    },
  });

  // Uploaded R2 URL — the photo prompt step returns it before the detail form
  // is rendered. Once we have it, we swap the shared prompt for the detail
  // fields. Also mirrored into RHF `photoUrl` so the zod schema passes.
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [stagedPhotoUrl, setStagedPhotoUrl] = useState<string | null>(null);
  // Success card replaces the whole flow once the create call returns 201.
  const [success, setSuccess] = useState<{
    id: string;
    email: string;
    emailSent: boolean;
  } | null>(null);

  useEffect(() => {
    void apiFetch('/api/signup/state', { schema: SignupState })
      .then((state) => {
        if (state.role !== providerRole) return;
        if (state.photo.status === 'CONFIRMED') {
          setUploadedPhotoUrl(state.photo.imageUrl);
          form.setValue('photoUrl', state.photo.imageUrl ?? '', { shouldValidate: true });
        } else if (state.photo.status === 'STAGED') {
          setStagedPhotoUrl(state.photo.imageUrl);
        }
      })
      .catch(() => {});
  }, [form, providerRole]);

  const onSubmit = form.handleSubmit(async (values) => {
    if (!values.photoUrl || !values.photoUrl.startsWith('http')) {
      form.setError('photoUrl', { type: 'server', message: tFields('photoRequired') });
      return;
    }
    try {
      const created = await apiFetch('/api/instructors', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: InstructorCreated,
      });
      setSuccess({ id: created.id, email: values.email, emailSent: created.emailSent });
    } catch (err) {
      const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
      if (!applied) {
        toast.error(t('error'));
      }
    }
  });

  if (success) {
    return (
      <Card className="border-border bg-card shadow-sm" role="status">
        <CardHeader>
          <CardTitle className="text-h3">{t('success.title')}</CardTitle>
          <CardDescription className="grid gap-2 text-body">
            <span>{t('success.body', { email: success.email })}</span>
            <span
              className={
                success.emailSent ? 'text-brand-700 dark:text-brand-300' : 'text-destructive'
              }
            >
              {success.emailSent ? t('success.emailSent') : t('success.emailFailed')}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            className="shadow-sm"
            onClick={() => router.push(`/instructors/${success.id}`)}
          >
            {t('success.viewProfile')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!uploadedPhotoUrl) {
    return (
      <Card className="border-border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <PhotoPromptStep
            endpoint="/api/instructors/photo"
            fieldName="photo"
            initialStagedUrl={stagedPhotoUrl}
            onConfirmed={(url) => {
              setUploadedPhotoUrl(url);
              setStagedPhotoUrl(null);
              form.setValue('photoUrl', url, { shouldValidate: true });
            }}
            copy={{
              eyebrow: tPicture('stepEyebrow'),
              title: tPicture('stepTitle'),
              lead: tPicture('stepLead'),
              placeholderAria: tPicture('placeholderAria'),
              chooseButton: tPicture('chooseButton'),
              dragHint: tPicture('dragHint'),
              submit: tPicture('submit'),
              submitting: tPicture('submitting'),
              confirm: tPicture('confirm'),
              confirming: tPicture('confirming'),
              confirmationLabel: tPicture('confirmationLabel'),
              staged: tPicture('staged'),
              whyWeAsk: tPicture('whyWeAsk'),
              errors: {
                pictureRequired: tPicture('errors.pictureRequired'),
                pictureWrongType: tPicture('errors.pictureWrongType'),
                pictureTooLarge: tPicture('errors.pictureTooLarge'),
                pictureUploadFailed: tPicture('errors.pictureUploadFailed'),
                proxyFailure: tPicture('errors.proxyFailure'),
              },
            }}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('subtitle')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-5" noValidate>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border bg-muted">
                <Image src={uploadedPhotoUrl} alt="" fill sizes="80px" className="object-cover" />
              </div>
              <div className="flex-1 grid gap-1">
                <p className="text-eyebrow text-muted-foreground">{tFields('photoLabel')}</p>
                <p className="text-caption text-muted-foreground">{tFields('photoDescription')}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="justify-self-start px-0 h-auto"
                  onClick={() => {
                    setUploadedPhotoUrl(null);
                    form.setValue('photoUrl', '');
                  }}
                >
                  {tPicture('chooseButton')}
                </Button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tFields('nameLabel')}</FormLabel>
                    <FormControl>
                      <Input
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
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{tFields('cityLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete="address-level2"
                        placeholder={tFields('cityPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="serviceArea"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tFields('serviceAreaLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={tFields('serviceAreaPlaceholder')}
                      maxLength={160}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>{tFields('serviceAreaDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categories"
              render={({ field }) => {
                const selected = field.value;
                return (
                  <FormItem>
                    <FormLabel>{tFields('categoriesLabel')}</FormLabel>
                    <FormDescription>{tFields('categoriesDescription')}</FormDescription>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {LICENCE_CATEGORY_CODES.map((code) => {
                        const checked = selected.includes(code);
                        const inputId = `category-${code}`;
                        return (
                          <div
                            key={code}
                            className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-small font-medium transition-colors hover:bg-accent"
                          >
                            <Checkbox
                              id={inputId}
                              checked={checked}
                              onCheckedChange={(state) => {
                                if (state === true) {
                                  field.onChange([...selected, code]);
                                } else {
                                  field.onChange(selected.filter((c) => c !== code));
                                }
                              }}
                            />
                            <label
                              htmlFor={inputId}
                              className="flex cursor-pointer items-center gap-2 leading-none"
                            >
                              <span>{code}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            <FormField
              control={form.control}
              name="hourlyRateSek"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tFields('rateLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      placeholder={tFields('ratePlaceholder')}
                      {...field}
                      value={
                        typeof field.value === 'number' && Number.isFinite(field.value)
                          ? field.value
                          : ''
                      }
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormDescription>{tFields('rateDescription')}</FormDescription>
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
                  <FormDescription>{tFields('emailDescription')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tFields('bioLabel')}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder={tFields('bioPlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={form.formState.isSubmitting} className="shadow-sm">
              {form.formState.isSubmitting ? t('submitting') : t('submit')}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
