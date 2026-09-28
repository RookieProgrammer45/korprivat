'use client';

// Signup wizard — path first (Airbnb/Uber style), then account details.
//
// Step contract (discriminated by `step`):
//   path        → choose LEARNER | SCHOOL | INSTRUCTOR (no credentials yet)
//   account     → name / email / password + path-specific fields only
//   verifyEmail → confirm address (emailVerified must flip true)
//   photo|license|handledare → post-auth onboarding as required
//
// LEARNER    → DOB (≥16) → email verify → optional photo → ID KYC (verify)
// SCHOOL     → school name, org number, city → photo → Transportstyrelsen licence
// INSTRUCTOR → licence held ≥5 years + city → photo → teaching credentials

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
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
import { apiFetch } from '@/lib/api-client';
import { signUp, useSession, authClient } from '@/lib/auth-client';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/auth';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { LicenseUploadResponse } from '@/lib/contracts/instructor-license';
import {
  SignupCompleteResponse,
  type SignupPath as SignupPathType,
  SignupState,
} from '@/lib/contracts/signup';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { applyServerErrors } from '@/lib/forms';
import {
  isInstructorLicenseTenureEligible,
  MIN_INSTRUCTOR_LICENSE_YEARS,
  roleForSignupPath,
} from '@/lib/signup-eligibility';
import { ageInYears, MINIMUM_AGE } from '@/lib/verification/age';
import { ClickwrapStep } from './clickwrap-step';
import {
  claimedDobIsUnderage,
  LearnerDobConsentFields,
} from './learner-dob-consent-fields';
import { PhotoPromptStep } from './photo-prompt-step';
import { SocialAuthButtons } from './social-auth-buttons';

type Step = 'path' | 'account' | 'verifyEmail' | 'photo' | 'license' | 'handledare';

const PATH_OPTIONS = [
  {
    value: 'LEARNER' as const,
    labelKey: 'roleLearner' as const,
    descKey: 'roleLearnerDesc' as const,
  },
  {
    value: 'SCHOOL' as const,
    labelKey: 'roleSchool' as const,
    descKey: 'roleSchoolDesc' as const,
  },
  {
    value: 'INSTRUCTOR' as const,
    labelKey: 'roleInstructor' as const,
    descKey: 'roleInstructorDesc' as const,
  },
];

type AccountValues = {
  name: string;
  email: string;
  password: string;
  path: SignupPathType;
  dateOfBirth: string;
  phone: string;
  city: string;
  schoolName: string;
  organizationNumber: string;
  licenseHeldYears: string;
  consent: boolean;
};

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_PDF_BYTES = 50 * 1024 * 1024;
const ACCEPT_MIME = 'image/*,application/pdf';

function withSignupFlag(path: string): string {
  return `${path}${path.includes('?') ? '&' : '?'}signup=1`;
}

export function SignUpForm({
  next,
  initialPath,
  initialStep,
}: {
  next?: string;
  /** Pre-select marketplace path from /signup?role=… (LEARNER default). */
  initialPath?: SignupPathType;
  /** Deep-link after email verify: /signup?step=photo */
  initialStep?: 'photo';
}) {
  const router = useRouter();
  const t = useTranslations('auth.signUp');
  const tConsentForm = useTranslations('consentForm');
  const tConsentBanner = useTranslations('consentBanner');
  const { data: session } = useSession();

  const resolvedPath: SignupPathType = initialPath ?? 'LEARNER';
  // Deep-link from hero (role=instructor) skips the path picker; user can go back.
  const [step, setStep] = useState<Step>(
    initialStep === 'photo' ? 'photo' : initialPath ? 'account' : 'path',
  );
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [attested, setAttested] = useState(false);
  const [licenseConsent, setLicenseConsent] = useState(false);
  const [submittingLicense, setSubmittingLicense] = useState(false);
  const [submittingClickwrap, setSubmittingClickwrap] = useState(false);
  const [stagedPhotoUrl, setStagedPhotoUrl] = useState<string | null>(null);
  const [signupPath, setSignupPath] = useState<SignupPathType | null>(initialPath ?? null);
  const [pendingEmail, setPendingEmail] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const form = useForm<AccountValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      path: resolvedPath,
      dateOfBirth: '',
      phone: '',
      city: '',
      schoolName: '',
      organizationNumber: '',
      licenseHeldYears: '',
      consent: false,
    },
    mode: 'onTouched',
  });

  const selectedPath = useWatch({ control: form.control, name: 'path' });
  const dateOfBirthValue = useWatch({ control: form.control, name: 'dateOfBirth' });
  const consentValue = useWatch({ control: form.control, name: 'consent' });
  const learnerUnderage =
    selectedPath === 'LEARNER' && claimedDobIsUnderage(dateOfBirthValue ?? '');

  const completeSignup = useCallback(async () => {
    try {
      const result = await apiFetch('/api/signup/complete', {
        method: 'POST',
        body: JSON.stringify({
          next:
            signupPath === 'SCHOOL'
              ? (next ?? '/dashboard/school')
              : next,
        }),
        schema: SignupCompleteResponse,
      });
      router.push(withSignupFlag(result.next ?? result.to));
      router.refresh();
    } catch {
      toast.error(t('errors.generic'));
    }
  }, [next, router, signupPath, t]);

  const applySignupState = useCallback(
    (state: ReturnType<typeof SignupState.parse>) => {
      if (state.path) {
        setSignupPath(state.path);
        form.setValue('path', state.path, { shouldValidate: true });
      }
      if (state.email) setPendingEmail(state.email);
      setStagedPhotoUrl(state.photo.status === 'STAGED' ? state.photo.imageUrl : null);

      if (!state.emailVerified) {
        setStep('verifyEmail');
        return;
      }

      // SCHOOL: no photo / licence — create org via complete and land on next.
      if (state.path === 'SCHOOL') {
        void completeSignup();
        return;
      }

      if (state.nextPrerequisite === 'photo') setStep('photo');
      else if (state.nextPrerequisite === 'license') setStep('license');
      else if (state.nextPrerequisite === 'clickwrap') setStep('handledare');
      else if (state.role === 'STUDENT' && state.photo.status !== 'CONFIRMED') {
        // LEARNER: account → email → optional profile photo → verify (via complete).
        setStep('photo');
      } else {
        void completeSignup();
      }
    },
    [completeSignup, form],
  );

  const handlePathChange = (path: SignupPathType) => {
    form.setValue('path', path, { shouldDirty: true, shouldValidate: true });
    setSignupPath(path);
    setLicenseFile(null);
    setAttested(false);
    setLicenseConsent(false);
    setSubmittingClickwrap(false);
  };

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

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = setInterval(() => {
      setResendCooldown((n) => Math.max(0, n - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [resendCooldown]);

  useEffect(() => {
    if (step !== 'verifyEmail') return;
    let active = true;
    const tick = async () => {
      try {
        const state = await apiFetch('/api/signup/state', { schema: SignupState });
        if (!active) return;
        if (state.emailVerified) applySignupState(state);
      } catch {
        // keep polling
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [step, applySignupState]);

  const resendVerificationEmail = async () => {
    const email = pendingEmail || form.getValues('email');
    if (!email || resendCooldown > 0) return;
    try {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: '/signup?step=photo',
      });
      if (error) {
        toast.error(t('step.verifyEmail.resendFailed'));
        return;
      }
      toast.success(t('step.verifyEmail.resent'));
      setResendCooldown(60);
    } catch {
      toast.error(t('step.verifyEmail.resendFailed'));
    }
  };

  const selectPath = (path: SignupPathType) => {
    handlePathChange(path);
    setStep('account');
  };

  const accountTitleKey =
    selectedPath === 'SCHOOL'
      ? 'accountTitleSchool'
      : selectedPath === 'INSTRUCTOR'
        ? 'accountTitleInstructor'
        : 'accountTitleLearner';
  const accountLeadKey =
    selectedPath === 'SCHOOL'
      ? 'accountLeadSchool'
      : selectedPath === 'INSTRUCTOR'
        ? 'accountLeadInstructor'
        : 'accountLeadLearner';

  const submitAccount = form.handleSubmit(
    async (values) => {
      if (!values.consent) {
        form.setError('consent', { message: tConsentForm('signupCheckboxError') });
        return;
      }
      if (values.path === 'LEARNER') {
        const dob = new Date(values.dateOfBirth);
        if (!values.dateOfBirth || Number.isNaN(dob.getTime()) || ageInYears(dob) < MINIMUM_AGE) {
          form.setError('dateOfBirth', {
            message: t('fields.errors.learnerAge', { age: MINIMUM_AGE }),
          });
          return;
        }
      }
      if (values.path === 'SCHOOL') {
        if (!values.schoolName.trim()) {
          form.setError('schoolName', { message: t('fields.errors.schoolName') });
          return;
        }
        if (!values.organizationNumber.trim()) {
          form.setError('organizationNumber', { message: t('fields.errors.organizationNumber') });
          return;
        }
        if (!values.city.trim()) {
          form.setError('city', { message: t('fields.errors.city') });
          return;
        }
      }
      if (values.path === 'INSTRUCTOR') {
        const years = Number(values.licenseHeldYears);
        if (!isInstructorLicenseTenureEligible(years)) {
          form.setError('licenseHeldYears', {
            message: t('fields.errors.licenseYears', { years: MIN_INSTRUCTOR_LICENSE_YEARS }),
          });
          return;
        }
        if (!values.city.trim()) {
          form.setError('city', { message: t('fields.errors.city') });
          return;
        }
      }

      const { error } = await signUp.email({
        name: values.name.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      if (error) {
        const applied = applyServerErrors(error, form.setError);
        if (!applied) toast.error(t('errors.generic'));
        return;
      }

      setPendingEmail(values.email.trim());
      setResendCooldown(60);

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
        // best-effort
      }

      try {
        await apiFetch('/api/signup/start', {
          method: 'POST',
          body: JSON.stringify({
            path: values.path,
            dateOfBirth: values.dateOfBirth || undefined,
            phone: values.phone.trim() || undefined,
            city: values.city.trim() || undefined,
            schoolName: values.schoolName.trim() || undefined,
            organizationNumber: values.organizationNumber.trim() || undefined,
            licenseHeldYears:
              values.licenseHeldYears === '' ? undefined : Number(values.licenseHeldYears),
          }),
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
        // best-effort
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

  const licenseCopyKey = signupPath === 'SCHOOL' ? 'school' : 'instructor';
  const photoCopyKey =
    signupPath === 'SCHOOL' ? 'school' : signupPath === 'LEARNER' ? 'learner' : 'instructor';
  const isLearnerPhoto = signupPath === 'LEARNER';
  const LEARNER_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

  if (step === 'path') {
    return (
      <div className="grid gap-8">
        <div className="grid gap-2">
          <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('pathTitle')}
          </h1>
          <p className="text-pretty text-body text-muted-foreground">{t('pathSubtitle')}</p>
        </div>
        <ul className="grid gap-3">
          {PATH_OPTIONS.map(({ value, labelKey, descKey }) => (
            <li key={value}>
              <button
                type="button"
                onClick={() => selectPath(value)}
                className="auth-path-option group flex w-full min-w-0 items-center gap-4 rounded-2xl border border-border bg-card px-4 py-4 text-left transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-brand-400 hover:bg-brand-50/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:hover:bg-brand-950/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-pretty text-base font-semibold text-foreground">
                    {t(`fields.${labelKey}`)}
                  </span>
                  <span className="mt-1 block text-pretty text-small text-muted-foreground">
                    {t(`fields.${descKey}`)}
                  </span>
                </span>
                <ChevronRight
                  aria-hidden
                  className="size-5 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-600"
                />
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (step === 'verifyEmail') {
    const email = pendingEmail || form.getValues('email') || session?.user?.email || '';
    return (
      <div className="grid gap-5">
        <div className="grid gap-2">
          <p className="text-eyebrow text-muted-foreground">{t('step.verifyEmail.eyebrow')}</p>
          <p className="text-h4 text-foreground">{t('step.verifyEmail.title')}</p>
          <p className="text-body text-muted-foreground">
            {t('step.verifyEmail.body', { email })}
          </p>
        </div>
        <p className="text-small text-muted-foreground" aria-live="polite">
          {t('step.verifyEmail.polling')}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            disabled={resendCooldown > 0}
            onClick={() => void resendVerificationEmail()}
          >
            {resendCooldown > 0
              ? t('step.verifyEmail.resendIn', { n: resendCooldown })
              : t('step.verifyEmail.resend')}
          </Button>
        </div>
      </div>
    );
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
        allowSkip={isLearnerPhoto}
        onSkip={isLearnerPhoto ? () => void completeSignup() : undefined}
        skipLabel={isLearnerPhoto ? t('pictureUpload.skip') : undefined}
        maxBytes={isLearnerPhoto ? LEARNER_PHOTO_MAX_BYTES : undefined}
        autoConfirmOnUpload={isLearnerPhoto}
        copy={{
          eyebrow: t(`segments.${photoCopyKey}.pictureUpload.stepEyebrow`),
          title: t(`segments.${photoCopyKey}.pictureUpload.stepTitle`),
          lead: t(`segments.${photoCopyKey}.pictureUpload.stepLead`),
          placeholderAria: t('pictureUpload.placeholderAria'),
          chooseButton: t('pictureUpload.chooseButton'),
          dragHint: t('pictureUpload.dragHint'),
          submit: t('pictureUpload.submit'),
          submitting: t('pictureUpload.submitting'),
          confirm: t('pictureUpload.confirm'),
          confirming: t('pictureUpload.confirming'),
          confirmationLabel: t('pictureUpload.confirmationLabel'),
          staged: t('pictureUpload.staged'),
          whyWeAsk: t(`segments.${photoCopyKey}.pictureUpload.whyWeAsk`),
          errors: {
            pictureRequired: t('pictureUpload.errors.pictureRequired'),
            pictureWrongType: t('pictureUpload.errors.pictureWrongType'),
            pictureTooLarge: isLearnerPhoto
              ? t('pictureUpload.errors.pictureTooLargeLearner')
              : t('pictureUpload.errors.pictureTooLarge'),
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
          <p className="text-eyebrow text-muted-foreground">
            {t(`segments.${licenseCopyKey}.licenseUpload.stepEyebrow`)}
          </p>
          <p className="text-h4 text-foreground">
            {t(`segments.${licenseCopyKey}.licenseUpload.stepTitle`)}
          </p>
          <p className="text-body text-muted-foreground">
            {t(`segments.${licenseCopyKey}.licenseUpload.stepLead`)}
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="signup-license">
            {t(`segments.${licenseCopyKey}.licenseUpload.fields.licenseLabel`)}
          </Label>
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
                onClick={(event) => event.stopPropagation()}
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
          <span className="font-medium text-foreground">
            {t(`segments.${licenseCopyKey}.licenseUpload.fields.attestationLabel`)}
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
    <div className="grid gap-5">
      <div className="mb-1 grid gap-3">
        <button
          type="button"
          onClick={() => setStep('path')}
          className="w-fit text-small font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ← {t('backToPaths')}
        </button>
        <div className="grid gap-2">
          <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t(accountTitleKey)}
          </h1>
          <p className="text-pretty text-body text-muted-foreground">{t(accountLeadKey)}</p>
        </div>
      </div>

      <SocialAuthButtons
        mode="signup"
        role={roleForSignupPath(selectedPath)}
        next={selectedPath === 'SCHOOL' ? (next ?? '/for-skolor') : next}
      />

      <Form {...form}>
        <form onSubmit={submitAccount} className="auth-form grid gap-5" noValidate>
          <FormField
            control={form.control}
            name="name"
          rules={{ required: true }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.nameLabel')}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="name"
                  className="auth-input h-12"
                  placeholder={t('fields.namePlaceholder')}
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

        {selectedPath === 'LEARNER' ? (
          <div className="grid gap-4 border-t border-border pt-4">
            <LearnerDobConsentFields
              idPrefix="signup-dob"
              includeDob
              includeConsent={false}
              dob={dateOfBirthValue ?? ''}
              onDobChange={(value) => {
                form.setValue('dateOfBirth', value, { shouldDirty: true, shouldValidate: true });
                if (claimedDobIsUnderage(value)) {
                  form.setError('dateOfBirth', {
                    message: t('fields.errors.learnerAge', { age: MINIMUM_AGE }),
                  });
                } else if (value) {
                  form.clearErrors('dateOfBirth');
                }
              }}
              consent={false}
              onConsentChange={() => {}}
              errors={{
                dateOfBirth: form.formState.errors.dateOfBirth?.message,
              }}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.phoneLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className="auth-input h-12"
                      placeholder={t('fields.phonePlaceholder')}
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
                  <FormLabel>{t('fields.cityLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="address-level2"
                      className="auth-input h-12"
                      placeholder={t('fields.cityPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {selectedPath === 'SCHOOL' ? (
          <div className="grid gap-4 border-t border-border pt-4">
            <FormField
              control={form.control}
              name="schoolName"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.schoolNameLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="organization"
                      className="auth-input h-12"
                      placeholder={t('fields.schoolNamePlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="organizationNumber"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.organizationNumberLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      spellCheck={false}
                      className="auth-input h-12"
                      placeholder={t('fields.organizationNumberPlaceholder')}
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
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.cityLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="address-level2"
                      className="auth-input h-12"
                      placeholder={t('fields.cityPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        {selectedPath === 'INSTRUCTOR' ? (
          <div className="grid gap-4 border-t border-border pt-4">
            <FormField
              control={form.control}
              name="licenseHeldYears"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.licenseHeldYearsLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={MIN_INSTRUCTOR_LICENSE_YEARS}
                      max={80}
                      className="auth-input h-12"
                      placeholder={t('fields.licenseHeldYearsPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <p className="text-caption text-muted-foreground">
                    {t('fields.licenseHeldYearsHelp', { years: MIN_INSTRUCTOR_LICENSE_YEARS })}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.cityLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="address-level2"
                      className="auth-input h-12"
                      placeholder={t('fields.cityPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        ) : null}

        <LearnerDobConsentFields
          idPrefix="signup"
          includeDob={false}
          dob=""
          onDobChange={() => {}}
          consent={consentValue === true}
          onConsentChange={(value) => {
            form.setValue('consent', value, { shouldDirty: true, shouldValidate: true });
            if (value) form.clearErrors('consent');
            else {
              form.setError('consent', { message: tConsentForm('signupCheckboxError') });
            }
          }}
          errors={{
            consent: form.formState.errors.consent?.message,
          }}
        />
        <Button
          type="submit"
          size="lg"
          disabled={form.formState.isSubmitting || learnerUnderage}
          className="auth-submit mt-1 h-12 w-full text-base shadow-sm"
        >
          {form.formState.isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </form>
    </Form>
    </div>
  );
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
