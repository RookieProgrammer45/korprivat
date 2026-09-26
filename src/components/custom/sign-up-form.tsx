// @polsia:user-owned
'use client';

// Signup wizard — account creation first, then role-specific onboarding.
//
// Step 1 — Account: name / email / password / path picker
//   LEARNER    → date of birth (≥16) + optional phone/city → dashboard
//   SCHOOL     → school name, org number, city → photo → Transportstyrelsen licence
//   INSTRUCTOR → licence held ≥5 years + city → photo → teaching credentials
// Handledare clickwrap remains only for resumable legacy sessions.

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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { apiFetch } from '@/lib/api-client';
import { signUp, useSession } from '@/lib/auth-client';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/auth';
import { HANDLEDARE_TERMS_VERSION } from '@/lib/contracts/clickwrap';
import { LicenseUploadResponse } from '@/lib/contracts/instructor-license';
import {
  SignupCompleteResponse,
  SignupPath,
  SignupState,
  type SignupPath as SignupPathType,
} from '@/lib/contracts/signup';
import { AgeCheckResponse, SignupCapabilities } from '@/lib/contracts/didit-age';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { applyServerErrors } from '@/lib/forms';
import {
  isInstructorLicenseTenureEligible,
  isLearnerAgeEligible,
  MIN_INSTRUCTOR_LICENSE_YEARS,
  MIN_LEARNER_AGE_YEARS,
} from '@/lib/signup-eligibility';
import { ClickwrapStep } from './clickwrap-step';
import { PhotoPromptStep } from './photo-prompt-step';

type Step = 'account' | 'photo' | 'license' | 'handledare';

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

function isSignupPath(value: string): value is SignupPathType {
  return SignupPath.safeParse(value).success;
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
  const [signupPath, setSignupPath] = useState<SignupPathType | null>('LEARNER');
  const [diditAgeCheck, setDiditAgeCheck] = useState(false);
  const [faceFile, setFaceFile] = useState<File | null>(null);
  const [ageCheck, setAgeCheck] = useState<{
    eligible: boolean;
    estimatedAge: number | null;
    requestId: string | null;
    status: string;
  } | null>(null);
  const [checkingAge, setCheckingAge] = useState(false);

  const form = useForm<AccountValues>({
    defaultValues: {
      name: '',
      email: '',
      password: '',
      path: 'LEARNER',
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
      if (state.path) {
        setSignupPath(state.path);
        form.setValue('path', state.path, { shouldValidate: true });
      }
      setStagedPhotoUrl(state.photo.status === 'STAGED' ? state.photo.imageUrl : null);
      if (state.nextPrerequisite === 'photo') setStep('photo');
      else if (state.nextPrerequisite === 'license') setStep('license');
      else if (state.nextPrerequisite === 'clickwrap') setStep('handledare');
      else void completeSignup();
    },
    [completeSignup, form],
  );

  useEffect(() => {
    let active = true;
    apiFetch('/api/signup/capabilities', { schema: SignupCapabilities })
      .then((caps) => {
        if (active) setDiditAgeCheck(caps.diditAgeCheck);
      })
      .catch(() => {
        if (active) setDiditAgeCheck(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const handlePathChange = (path: SignupPathType) => {
    form.setValue('path', path, { shouldDirty: true, shouldValidate: true });
    setSignupPath(path);
    setLicenseFile(null);
    setAttested(false);
    setLicenseConsent(false);
    setSubmittingClickwrap(false);
    setFaceFile(null);
    setAgeCheck(null);
  };

  const runAgeCheck = async (): Promise<typeof ageCheck> => {
    if (!diditAgeCheck || selectedPath !== 'LEARNER') return null;
    if (!faceFile) {
      toast.error(t('fields.errors.faceRequired'));
      return null;
    }
    setCheckingAge(true);
    try {
      const fd = new FormData();
      fd.append('face', faceFile, faceFile.name || 'selfie.jpg');
      const response = await fetch('/api/signup/age-check', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const body = await response.json().catch(() => null);
      const parsed = AgeCheckResponse.safeParse(body);
      if (!parsed.success) {
        toast.error(t('fields.errors.ageCheckFailed'));
        return null;
      }
      setAgeCheck({
        eligible: parsed.data.eligible,
        estimatedAge: parsed.data.estimatedAge,
        requestId: parsed.data.requestId,
        status: parsed.data.status,
      });
      if (!parsed.data.eligible) {
        toast.error(t('fields.errors.ageCheckIneligible', { age: MIN_LEARNER_AGE_YEARS }));
        return null;
      }
      return {
        eligible: parsed.data.eligible,
        estimatedAge: parsed.data.estimatedAge,
        requestId: parsed.data.requestId,
        status: parsed.data.status,
      };
    } catch {
      toast.error(t('fields.errors.ageCheckFailed'));
      return null;
    } finally {
      setCheckingAge(false);
    }
  };

  const submitAccount = form.handleSubmit(
    async (values) => {
      if (values.path === 'LEARNER') {
        const dob = new Date(values.dateOfBirth);
        if (!values.dateOfBirth || Number.isNaN(dob.getTime()) || !isLearnerAgeEligible(dob)) {
          form.setError('dateOfBirth', {
            message: t('fields.errors.learnerAge', { age: MIN_LEARNER_AGE_YEARS }),
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

      let learnerAge = ageCheck;
      if (values.path === 'LEARNER' && diditAgeCheck) {
        learnerAge = (await runAgeCheck()) ?? null;
        if (!learnerAge?.eligible) return;
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
            ageEstimatedYears: learnerAge?.estimatedAge ?? undefined,
            ageCheckRequestId: learnerAge?.requestId ?? undefined,
            ageCheckStatus: learnerAge?.status ?? undefined,
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
          eyebrow: t(`segments.${licenseCopyKey}.pictureUpload.stepEyebrow`),
          title: t(`segments.${licenseCopyKey}.pictureUpload.stepTitle`),
          lead: t(`segments.${licenseCopyKey}.pictureUpload.stepLead`),
          placeholderAria: t('pictureUpload.placeholderAria'),
          chooseButton: t('pictureUpload.chooseButton'),
          dragHint: t('pictureUpload.dragHint'),
          submit: t('pictureUpload.submit'),
          submitting: t('pictureUpload.submitting'),
          confirm: t('pictureUpload.confirm'),
          confirming: t('pictureUpload.confirming'),
          confirmationLabel: t('pictureUpload.confirmationLabel'),
          staged: t('pictureUpload.staged'),
          whyWeAsk: t(`segments.${licenseCopyKey}.pictureUpload.whyWeAsk`),
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
          <p className="text-[0.8rem] text-muted-foreground">{t('licenseUpload.fields.licenseHelp')}</p>
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
          name="path"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('fields.roleLabel')}</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={(value) => {
                    if (isSignupPath(value)) handlePathChange(value);
                  }}
                  onBlur={field.onBlur}
                  value={field.value}
                  className="grid min-w-0 grid-cols-1 gap-3"
                >
                  {(
                    [
                      ['LEARNER', 'roleLearner', 'roleLearnerDesc'],
                      ['SCHOOL', 'roleSchool', 'roleSchoolDesc'],
                      ['INSTRUCTOR', 'roleInstructor', 'roleInstructorDesc'],
                    ] as const
                  ).map(([value, labelKey, descKey]) => (
                    <div
                      key={value}
                      className={`group relative min-w-0 rounded-md border bg-card transition-colors focus-within:ring-2 focus-within:ring-brand-500/30 ${
                        field.value === value
                          ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                          : 'border-input hover:border-brand-500'
                      } flex h-full cursor-pointer items-start gap-3 px-3 py-3 text-small`}
                    >
                      <RadioGroupItem
                        id={`role-${value.toLowerCase()}`}
                        value={value}
                        aria-label={`${t(`fields.${labelKey}`)}. ${t(`fields.${descKey}`)}`}
                        className="absolute inset-0 z-10 h-full w-full rounded-md border-0 bg-transparent opacity-0 shadow-none focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-brand-500/50 [&>span]:hidden"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none flex min-w-0 flex-1 flex-col gap-1"
                      >
                        <span className="break-words text-pretty font-medium text-foreground">
                          {t(`fields.${labelKey}`)}
                        </span>
                        <span className="break-words text-caption text-muted-foreground [text-wrap:pretty]">
                          {t(`fields.${descKey}`)}
                        </span>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {selectedPath === 'LEARNER' ? (
          <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-caption font-medium text-muted-foreground">
              {t('fields.learnerSection')}
            </p>
            <FormField
              control={form.control}
              name="dateOfBirth"
              rules={{ required: true }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fields.dateOfBirthLabel')}</FormLabel>
                  <FormControl>
                    <Input type="date" autoComplete="bday" {...field} />
                  </FormControl>
                  <p className="text-caption text-muted-foreground">
                    {t('fields.dateOfBirthHelp', { age: MIN_LEARNER_AGE_YEARS })}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
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
                      placeholder={t('fields.cityPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {diditAgeCheck ? (
              <div className="grid gap-2">
                <Label htmlFor="signup-face">{t('fields.faceLabel')}</Label>
                <p className="text-caption text-muted-foreground">{t('fields.faceHelp')}</p>
                <Input
                  id="signup-face"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/tiff"
                  className="cursor-pointer file:mr-3 file:cursor-pointer"
                  onChange={(e) => {
                    setFaceFile(e.target.files?.[0] ?? null);
                    setAgeCheck(null);
                  }}
                />
                <p className="text-caption text-muted-foreground">
                  {faceFile
                    ? faceFile.name
                    : ageCheck?.eligible
                      ? t('fields.faceVerified', { age: Math.floor(ageCheck.estimatedAge ?? 0) })
                      : t('fields.faceAlt')}
                </p>
              </div>
            ) : null}
          </div>
        ) : null}

        {selectedPath === 'SCHOOL' ? (
          <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-caption font-medium text-muted-foreground">
              {t('fields.schoolSection')}
            </p>
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
          <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-3">
            <p className="text-caption font-medium text-muted-foreground">
              {t('fields.instructorSection')}
            </p>
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
        <Button
          type="submit"
          disabled={form.formState.isSubmitting || checkingAge}
          className="shadow-sm"
        >
          {checkingAge
            ? t('fields.ageChecking')
            : form.formState.isSubmitting
              ? t('submitting')
              : t('submit')}
        </Button>
      </form>
    </Form>
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
