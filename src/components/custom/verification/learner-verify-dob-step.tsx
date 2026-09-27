'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  claimedDobIsUnderage,
  LearnerDobConsentFields,
} from '@/components/custom/learner-dob-consent-fields';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/auth';
import { SignupStartResponse } from '@/lib/contracts/signup-start';
import { ageInYears, MINIMUM_AGE } from '@/lib/verification/age';

/**
 * OAuth learners land on /onboarding/learner/verify without having posted
 * /api/signup/start. This phase collects claimed DOB + privacy consent
 * inline, then reloads so the server page can render Didit (phase 2).
 */
export function LearnerVerifyDobStep() {
  const t = useTranslations('onboarding.verify');
  const tSignUp = useTranslations('auth.signUp');
  const tConsentForm = useTranslations('consentForm');
  const router = useRouter();

  const [dob, setDob] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ dateOfBirth?: string; consent?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const underage = claimedDobIsUnderage(dob);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: { dateOfBirth?: string; consent?: string } = {};
    const parsed = new Date(dob);
    if (!dob || Number.isNaN(parsed.getTime()) || ageInYears(parsed) < MINIMUM_AGE) {
      nextErrors.dateOfBirth = tSignUp('fields.errors.learnerAge', { age: MINIMUM_AGE });
    }
    if (!consent) {
      nextErrors.consent = tConsentForm('signupCheckboxError');
    }
    if (nextErrors.dateOfBirth || nextErrors.consent) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
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
        // best-effort — same as email signup
      }

      await apiFetch('/api/signup/start', {
        method: 'POST',
        body: JSON.stringify({ path: 'LEARNER', dateOfBirth: dob }),
        schema: SignupStartResponse,
      });
      router.refresh();
    } catch {
      toast.error(tSignUp('errors.generic'));
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto grid w-full max-w-md gap-6">
      <div className="grid gap-2 text-center">
        <h1 className="text-title font-semibold tracking-tight">{t('dobPhase.heading')}</h1>
        <p className="text-body text-muted-foreground">{t('dobPhase.lead')}</p>
      </div>

      <LearnerDobConsentFields
        idPrefix="verify-dob"
        dob={dob}
        onDobChange={(value) => {
          setDob(value);
          if (claimedDobIsUnderage(value)) {
            setErrors((prev) => ({
              ...prev,
              dateOfBirth: tSignUp('fields.errors.learnerAge', { age: MINIMUM_AGE }),
            }));
          } else {
            setErrors((prev) => ({ ...prev, dateOfBirth: undefined }));
          }
        }}
        consent={consent}
        onConsentChange={(value) => {
          setConsent(value);
          setErrors((prev) => ({
            ...prev,
            consent: value ? undefined : prev.consent,
          }));
        }}
        errors={errors}
      />

      <Button
        type="submit"
        size="lg"
        disabled={submitting || underage}
        className="auth-submit h-12 w-full text-base shadow-sm"
      >
        {submitting ? t('dobPhase.submitting') : t('dobPhase.continue')}
      </Button>
    </form>
  );
}
