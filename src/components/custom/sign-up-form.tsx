// @polsia:user-owned
'use client';

// Signup wizard — account creation first, photo when required for schools.
//
// Step 1 — Account: name / email / password / role picker (Learner / School or
//   certified instructor / Handledare guidance). On submit calls better-auth's
//   `signUp.email` — a session is now established. Flow branches by role:
//     STUDENT   → complete signup → dashboard (?signup=1). Photo optional later.
//     HANDLEDARE → clickwrap step, then complete → handledare dashboard.
//     INSTRUCTOR → photo confirmation, then licence upload, then complete.
// Step 2 — Role-specific onboarding:
//   HANDLEDARE → clickwrap acceptance, then dashboard redirect.
//   INSTRUCTOR → photo + Transportstyrelsen credential upload + attestation.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiFetch } from '@/lib/api-client';
import { signUp, useSession } from '@/lib/auth-client';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/auth';
import { HANDLEDARE_TERMS_VERSION, type MarketplaceRole } from '@/lib/contracts/clickwrap';
import { LicenseUploadResponse } from '@/lib/contracts/instructor-license';
import { SignupCompleteResponse, SignupState } from '@/lib/contracts/signup';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { applyServerErrors } from '@/lib/forms';
import { ClickwrapStep } from './clickwrap-step';
import { PhotoPromptStep } from './photo-prompt-step';

type Step = 'account' | 'photo' | 'license' | 'handledare';

type AccountValues = {
  name: string;
  email: string;
  password: string;
  role: MarketplaceRole;
  consent: boolean;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const ACCEPT_MIME = 'image/*,application/pdf';

function withSignupFlag(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}signup=1`;
}

export function SignUpForm({ next }: { next?: string }) {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const tConsentForm = useTranslations('consentForm');
  const tConsentBanner = useTranslations('consentBanner');
  const { data: session } = useSession();

  const [step, setStep] = useState<Step>('account');
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [licenseConsent, setLicenseConsent] = useState(false);
  const [submittingLicense, setSubmittingLicense] = useState(false);
  const [submittingClickwrap, setSubmittingClickwrap] = useState(false);
  const [stagedPhotoUrl, setStagedPhotoUrl] = useState<string | null>(null);

  const form = useForm<AccountValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      role: 'STUDENT',
      consent: false,
    },
    mode: 'onTouched',
  });

  const completeSignup = useCallback(async () => {
    try {
      const result = await apiFetch('/api/signup/complete', {
        method: 'POST',
        body: JSON.stringify({ next }),
        schema: SignupCompleteResponse,
      });
      router.push(withSignupFlag(result.to));
      router.refresh();
    } catch {
      toast.error(t('errors.generic'));
    }
  }, [next, router, t]);

  const applySignupState = useCallback(
    (state: ReturnType<typeof SignupState.parse>) => {
      form.setValue('role', state.role, { shouldValidate: true });
      setStagedPhotoUrl(state.photo.status === 'STAGED' ? state.photo.imageUrl : null);
      if (state.nextPrerequisite === 'photo') setStep('photo');
      else if (state.nextPrerequisite === 'license') setStep('license');
      else if (state.nextPrerequisite === 'clickwrap') setStep('handledare');
      else void completeSignup();
    },
    [completeSignup, form],
  );

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    apiFetch('/api/signup/state', { schema: SignupState })
      .then((state) => {
        if (active) applySignupState(state);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [session?.user, applySignupState]);

  const handleRoleChange = (role: MarketplaceRole) => {
    form.setValue('role', role, { shouldDirty: true, shouldValidate: true });
    setLicenseFile(null);
    setAttested(false);
    setLicenseConsent(false);
    setSubmittingClickwrap(false);
  };

  const submitAccount = form.handleSubmit(
    async (values) => {
      const { error } = await signUp.email({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      if (error) {
        const applied = applyServerErrors(error, form.setError);
        if (!applied) {
          toast.error(t('errors.generic'));
        }
        return;
      }
      // Audit-row consent stamp for the GDPR privacy policy. We post this
      // AFTER the auth signup resolves because the server route stamps the
      // userId-less audit row with the visitor's subjectHash; once a session
      // is set, subsequent consent stamps will carry the userId. Best-effort:
      // a banner failure should not block the wizard's progress.
      try {
        await apiFetch('/api/consent', {
          method: 'POST',
          body: JSON.stringify({
            policyVersion: PRIVACY_POLICY_VERSION,
            scope: { essential: true, analytics: false, marketing: false },
            source: 'signup',
          }),
        });
      } catch {
        // swallow — banner will reappear on next visit if cookie didn't stick.
      }
      try {
        await apiFetch('/api/signup/start', {
          method: 'POST',
          body: JSON.stringify({ role: values.role }),
          schema: SignupStartResponse,
        });
        const state = await apiFetch('/api/signup/state', { schema: SignupState });
        applySignupState(state);
      } catch (err) {
        const applied = err instanceof Error && applyServerErrors(err.cause, form.setError);
        if (!applied) toast.error(t('errors.generic'));
      }
    },
    () => {
      const firstError = document.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-invalid]',
      );
      firstError?.focus();
    },
  );

  const advanceAfterPhoto = async () => {
    try {
      applySignupState(await apiFetch('/api/signup/state', { schema: SignupState }));
    } catch {
      toast.error(t('errors.generic'));
    }
  };

  const submitClickwrap = async () => {
    setSubmittingClickwrap(true);
    try {
      await apiFetch('/api/clickwrap', {
        method: 'POST',
        body: JSON.stringify({ termsVersion: HANDLEDARE_TERMS_VERSION }),
      });
    } catch {
      toast.error(t('clickwrap.errors.submitFailed'));
      setSubmittingClickwrap(false);
      return;
    }
    await completeSignup();
  };

  const submitLicense = async () => {
    if (!licenseConsent) {
      toast.error(tConsentForm('licenseCheckboxError'));
      return;
    }
    if (!attested) {
      toast.error(t('licenseUpload.errors.attestationRequired'));
      return;
    }
    if (!licenseFile) {
      toast.error(t('licenseUpload.errors.licenseMissing'));
      return;
    }
    const accepted = licenseAccepted(licenseFile);
    if (accepted === 'wrongType') {
      toast.error(t('licenseUpload.errors.licenseWrongType'));
      return;
    }
    if (accepted === 'tooLarge') {
      toast.error(t('licenseUpload.errors.licenseTooLarge'));
      return;
    }
    setSubmittingLicense(true);
    try {
      // Stamp the GDPR consent decision tied to the licence-processing
      // surface (Art. 6(1)(a) record of consent) BEFORE the licence upload.
      try {
        await apiFetch('/api/consent', {
          method: 'POST',
          body: JSON.stringify({
            policyVersion: PRIVACY_POLICY_VERSION,
            scope: { essential: true, analytics: false, marketing: false },
            source: 'license-upload',
          }),
        });
      } catch {
        // best-effort — don't block the licence upload on consent api hiccup
      }
      const fd = new FormData();
      fd.append('license', licenseFile, licenseFile.name || 'licence');
      fd.append('attestation', 'true');
      await uploadLicense(fd);
    } catch {
      toast.error(t('licenseUpload.errors.licenseUploadFailed'));
      setSubmittingLicense(false);
      return;
    }
    setSubmittingLicense(false);

    await completeSignup();
  };

  async function uploadLicense(fd: FormData): Promise<LicenseUploadResponse> {
    const response = await fetch('/api/instructor-license', {
      method: 'POST',
      body: fd,
      credentials: 'include',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error('license upload failed', { cause: body });
    return LicenseUploadResponse.parse(body);
  }

  if (step === 'photo') {
    return (
      <PhotoPromptStep
        endpoint="/api/profile/picture"
        fieldName="file"
        initialName={form.getValues('name')}
        initialStagedUrl={stagedPhotoUrl}
        onConfirmed={() => void advanceAfterPhoto()}
        onBack={() => setStep('account')}
        copy={{
          eyebrow: t('pictureUpload.stepEyebrow'),
          title: t('pictureUpload.stepTitle'),
          lead: t('pictureUpload.stepLead'),
          placeholderAria: t('pictureUpload.placeholderAria'),
          chooseButton: t('pictureUpload.chooseButton'),
          dragHint: t('pictureUpload.dragHint'),
          submit: t('pictureUpload.submit'),
          submitting: t('pictureUpload.submitting'),
          confirm: t('pictureUpload.confirm'),
          confirming: t('pictureUpload.confirming'),
          confirmationLabel: t('pictureUpload.confirmationLabel'),
          staged: t('pictureUpload.staged'),
          whyWeAsk: t('pictureUpload.whyWeAsk'),
          errors: {
            pictureRequired: t('pictureUpload.errors.pictureRequired'),
            pictureWrongType: t('pictureUpload.errors.pictureWrongType'),
            pictureTooLarge: t('pictureUpload.errors.pictureTooLarge'),
            pictureUploadFailed: t('pictureUpload.errors.pictureUploadFailed'),
            proxyFailure: t('pictureUpload.errors.proxyFailure'),
          },
        }}
      />
    );
  }

  if (step === 'license') {
    return (
      <div className="grid gap-4">
        <div className="grid gap-1">
          <p className="text-eyebrow text-muted-foreground">{t('licenseUpload.stepEyebrow')}</p>
          <p className="text-h4 text-foreground">{t('licenseUpload.stepTitle')}</p>
          <p className="text-body text-muted-foreground">{t('licenseUpload.stepLead')}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-license">{t('licenseUpload.fields.licenseLabel')}</Label>
          <p className="text-[0.8rem] text-muted-foreground">
            {t('licenseUpload.fields.licenseHelp')}
          </p>
          <Input
            id="signup-license"
            type="file"
            accept={ACCEPT_MIME}
            className="cursor-pointer file:mr-3 file:cursor-pointer"
            onChange={(e) => {
              setLicenseFile(e.target.files?.[0] ?? null);
            }}
          />
          <p className="text-caption text-muted-foreground">
            {licenseFile ? selectedFileLine(licenseFile) : t('licenseUpload.fields.licenseAlt')}
          </p>
        </div>
        <label
          htmlFor="signup-license-consent"
          className="flex cursor-pointer items-start gap-2 rounded-md border border-brand-500/40 bg-brand-100 px-3 py-2.5 text-small dark:bg-brand-900"
        >
          <Checkbox
            id="signup-license-consent"
            checked={licenseConsent}
            onCheckedChange={(checked) => setLicenseConsent(checked === true)}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="font-medium text-foreground">{tConsentForm('licenseCheckbox')}</span>
            <span className="text-caption text-muted-foreground">
              <Link
                href="/privacy"
                target="_blank"
                rel="noopener"
                className="underline-offset-2 hover:underline"
              >
                {tConsentBanner('privacy')}
              </Link>
            </span>
          </span>
        </label>
        <label
          htmlFor="signup-attestation"
          className="flex cursor-pointer items-start gap-2 rounded-md border border-input bg-card px-3 py-2.5 text-small"
        >
          <Checkbox
            id="signup-attestation"
            checked={attested}
            onCheckedChange={(checked) => setAttested(checked === true)}
            className="mt-0.5"
          />
          <span className="flex flex-col">
            <span className="font-medium text-foreground">
              {t('licenseUpload.fields.attestationLabel')}
            </span>
          </span>
        </label>
        <div className="dl-action-group flex-col sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep('account')}
            disabled={submittingLicense}
          >
            {t('licenseUpload.back')}
          </Button>
          <Button
            type="button"
            onClick={submitLicense}
            disabled={submittingLicense}
            className="shadow-sm"
          >
            {submittingLicense ? t('licenseUpload.submitting') : t('licenseUpload.submit')}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'handledare') {
    return (
      <ClickwrapStep
        copy={{
          title: t('clickwrap.stepTitle'),
          lead: t('clickwrap.stepLead'),
          versionEyebrow: t('clickwrap.versionEyebrow', {
            version: HANDLEDARE_TERMS_VERSION,
          }),
          bodyParagraphs: [
            t('clickwrap.bodyParagraphs.0'),
            t('clickwrap.bodyParagraphs.1'),
            t('clickwrap.bodyParagraphs.2'),
          ],
          checkboxLabel: t('clickwrap.checkboxLabel'),
          submit: t('clickwrap.submit'),
          submitting: t('clickwrap.submitting'),
          back: t('clickwrap.back'),
          errors: {
            attestationRequired: t('clickwrap.errors.attestationRequired'),
            submitFailed: t('clickwrap.errors.submitFailed'),
          },
        }}
        submitting={submittingClickwrap}
        onSubmit={submitClickwrap}
        onBack={() => setStep('account')}
      />
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={submitAccount} className="grid gap-5" noValidate>
        <FormField
          control={form.control}
          name="name"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.nameLabel')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" placeholder={t('fields.namePlaceholder')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
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
                  spellCheck={false}
                  inputMode="email"
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
          rules={{ required: true, minLength: 8 }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.passwordLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
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
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.roleLabel')}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    if (isMarketplaceRole(value)) handleRoleChange(value);
                  }}
                  onBlur={field.onBlur}
                  value={field.value}
                  className="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3"
                >
                  <div
                    className={`group relative min-w-0 rounded-md border bg-card transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 ${
                      field.value === 'STUDENT'
                        ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                        : 'border-input hover:border-brand-500'
                    } flex h-full cursor-pointer items-start gap-3 px-3 py-3 text-small`}
                  >
                    <RadioGroupItem
                      id="role-student"
                      value="STUDENT"
                      aria-label={`${t('fields.roleStudent')}. ${t('fields.roleStudentDesc')}`}
                      className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500/50 [&>span]:hidden"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1"
                    >
                      <span className="break-words text-pretty font-medium text-foreground">
                        {t('fields.roleStudent')}
                      </span>
                      <span className="break-words text-caption text-muted-foreground [text-wrap:pretty]">
                        {t('fields.roleStudentDesc')}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`group relative min-w-0 rounded-md border bg-card transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 ${
                      field.value === 'INSTRUCTOR'
                        ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                        : 'border-input hover:border-brand-500'
                    } flex h-full cursor-pointer items-start gap-3 px-3 py-3 text-small`}
                  >
                    <RadioGroupItem
                      id="role-instructor"
                      value="INSTRUCTOR"
                      aria-label={`${t('fields.roleInstructor')}. ${t('fields.roleInstructorDesc')}`}
                      className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500/50 [&>span]:hidden"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1"
                    >
                      <span className="break-words text-pretty font-medium text-foreground">
                        {t('fields.roleInstructor')}
                      </span>
                      <span className="break-words text-caption text-muted-foreground [text-wrap:pretty]">
                        {t('fields.roleInstructorDesc')}
                      </span>
                    </div>
                  </div>
                  <div
                    className={`group relative min-w-0 rounded-md border bg-card transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 ${
                      field.value === 'HANDLEDARE'
                        ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                        : 'border-input hover:border-brand-500'
                    } flex h-full cursor-pointer items-start gap-3 px-3 py-3 text-small`}
                  >
                    <RadioGroupItem
                      id="role-handledare"
                      value="HANDLEDARE"
                      aria-label={`${t('fields.roleHandledare')}. ${t('fields.roleHandledareDesc')}`}
                      className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500/50 [&>span]:hidden"
                    />
                    <div
                      aria-hidden="true"
                      className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1"
                    >
                      <span className="break-words text-pretty font-medium text-foreground">
                        {t('fields.roleHandledare')}
                      </span>
                      <span className="break-words text-caption text-muted-foreground [text-wrap:pretty]">
                        {t('fields.roleHandledareDesc')}
                      </span>
                    </div>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="consent"
          rules={{
            validate: (value) => value === true || tConsentForm('signupCheckboxError'),
          }}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <label
                  htmlFor="signup-consent"
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-brand-500/40 bg-brand-100 px-3 py-2.5 text-small dark:bg-brand-900"
                >
                  <Checkbox
                    id="signup-consent"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="flex flex-col">
                    <span className="font-medium text-foreground">
                      {tConsentForm('signupCheckbox')}{' '}
                      <Link
                        href="/privacy"
                        target="_blank"
                        rel="noopener"
                        className="underline-offset-2 hover:underline"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {tConsentForm('signupCheckboxLinkText')}
                      </Link>
                    </span>
                  </span>
                </label>
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
  );
}

function isMarketplaceRole(value: string): value is MarketplaceRole {
  return value === 'STUDENT' || value === 'INSTRUCTOR' || value === 'HANDLEDARE';
}

function licenseAccepted(file: File): 'ok' | 'wrongType' | 'tooLarge' {
  if (file.type.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) return 'tooLarge';
    return 'ok';
  }
  if (file.type === 'application/pdf') {
    if (file.size > MAX_PDF_BYTES) return 'tooLarge';
    return 'ok';
  }
  return 'wrongType';
}

function selectedFileLine(file: File): string {
  const kb = Math.max(1, Math.round(file.size / 1024));
  return `${file.name} · ${kb} KB`;
}
