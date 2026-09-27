'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MIN_LEARNER_AGE_YEARS } from '@/lib/signup-eligibility';
import { ageInYears, MINIMUM_AGE } from '@/lib/verification/age';

export type LearnerDobConsentErrors = {
  dateOfBirth?: string;
  consent?: string;
};

export type LearnerDobConsentFieldsProps = {
  dob: string;
  onDobChange: (value: string) => void;
  consent: boolean;
  onConsentChange: (value: boolean) => void;
  errors?: LearnerDobConsentErrors;
  /** Prefix for input ids when multiple instances could mount. */
  idPrefix?: string;
  /** When false, only the privacy consent checkbox is rendered. */
  includeDob?: boolean;
  /** When false, only the date-of-birth field is rendered. */
  includeConsent?: boolean;
};

/** Claimed DOB is a routing check only. Date-only UTC age, same helper as the state machine. */
export function claimedDobIsUnderage(value: string): boolean {
  if (!value) return false;
  const dob = new Date(value);
  if (Number.isNaN(dob.getTime())) return false;
  return ageInYears(dob) < MINIMUM_AGE;
}

/**
 * Shared DOB + privacy-consent fields for learner signup Step 1 and
 * OAuth verify phase 1 (collect what Google users skipped).
 */
export function LearnerDobConsentFields({
  dob,
  onDobChange,
  consent,
  onConsentChange,
  errors,
  idPrefix = 'learner',
  includeDob = true,
  includeConsent = true,
}: LearnerDobConsentFieldsProps) {
  const t = useTranslations('auth.signUp');
  const tConsentForm = useTranslations('consentForm');
  const dobId = `${idPrefix}-date-of-birth`;
  const consentId = `${idPrefix}-consent`;

  return (
    <div className="grid gap-4">
      {includeDob ? (
        <div className="grid gap-2">
          <Label htmlFor={dobId}>{t('fields.dateOfBirthLabel')}</Label>
          <Input
            id={dobId}
            type="date"
            autoComplete="bday"
            className="auth-input h-12"
            value={dob}
            aria-invalid={Boolean(errors?.dateOfBirth) || undefined}
            onChange={(event) => onDobChange(event.target.value)}
          />
          <p className="text-caption text-muted-foreground">
            {t('fields.dateOfBirthHelp', { age: MIN_LEARNER_AGE_YEARS })}
          </p>
          {errors?.dateOfBirth ? (
            <p className="text-small text-destructive" role="alert">
              {errors.dateOfBirth}
            </p>
          ) : null}
        </div>
      ) : null}

      {includeConsent ? (
        <div className="grid gap-2">
          <label
            htmlFor={consentId}
            className="flex cursor-pointer items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-3 text-small"
          >
            <Checkbox
              id={consentId}
              checked={consent}
              onCheckedChange={(checked) => onConsentChange(checked === true)}
              className="mt-0.5"
              aria-invalid={Boolean(errors?.consent) || undefined}
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
          {errors?.consent ? (
            <p className="text-small text-destructive" role="alert">
              {errors.consent}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
