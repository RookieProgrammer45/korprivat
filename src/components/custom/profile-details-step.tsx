'use client';

//
// Attio-style "get to know you" profile step for the signup wizard.
//
// Owns the post-account-creation profile moment: avatar upload/replace/remove,
// first/last name (a split view over better-auth's single `name` field), the
// locked email, an explicit product-update opt-in, and a live preview of how
// the public profile card will look. Replaces PhotoPromptStep inside the
// signup wizard ONLY — PhotoPromptStep stays for the other surfaces.
//
// Flow contract with SignUpForm: this step mounts while signed in and
// email-verified; onContinue() hands back to the parent, which refetches
// /api/signup/state and lets the existing state machine route the next step
// (learner → KYC verify, instructor → licence upload, school → dashboard).

import { Upload } from 'lucide-react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiFetch } from '@/lib/api-client';
import { authClient } from '@/lib/auth-client';
import { PRIVACY_POLICY_VERSION } from '@/lib/contracts/auth';
import { PhotoConfirmationResponse, PhotoUploadResponse } from '@/lib/contracts/photo-verification';
import type { SignupPath as SignupPathType } from '@/lib/contracts/signup';

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const REJECTED_EXTENSIONS = new Set(['.heic', '.heif']);

export type ProfileDetailsStepProps = {
  /** Signup path from the wizard; null for legacy rows. */
  signupPath: SignupPathType | null;
  /** Full name from the session (better-auth `User.name`). */
  sessionName: string;
  /** Locked email from the session (falls back to the form/pending email). */
  sessionEmail: string;
  /** Server-staged photo from a resumed signup. */
  initialStagedUrl?: string | null;
  /** Wizard position for the "4/5" indicator (Attio-style). */
  stepCurrent: number;
  stepTotal: number;
  /** Learner photos get the 5 MB limit; other paths use 20 MB. */
  learnerPhoto: boolean;
  /** When true, Continue stays disabled until a photo is staged/uploaded. */
  photoRequired?: boolean;
  maxBytes: number;
  onBack: () => void;
  /** Parent refetches signup state and routes the next step. */
  onContinue: () => void;
};

export function ProfileDetailsStep({
  signupPath,
  sessionName,
  sessionEmail,
  initialStagedUrl,
  stepCurrent,
  stepTotal,
  learnerPhoto,
  maxBytes,
  onBack,
  onContinue,
}: ProfileDetailsStepProps) {
  const t = useTranslations('auth.signUp.step.profile');
  const tPhoto = useTranslations('auth.signUp.pictureUpload');
  const tPhotoErrors = useTranslations('auth.signUp.pictureUpload.errors');
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialStagedUrl ?? null);
  const [stagedUrl, setStagedUrl] = useState<string | null>(initialStagedUrl ?? null);
  const [dragOver, setDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [subscribe, setSubscribe] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const originalName = sessionName.trim();
  const [firstName, setFirstName] = useState(() => splitName(originalName).first);
  const [lastName, setLastName] = useState(() => splitName(originalName).last);
  const [nameTouched, setNameTouched] = useState(false);

  // The session can resolve after mount (deep link: /signup?step=photo), so
  // keep the split fields in sync with the real name until the user edits.
  useEffect(() => {
    if (nameTouched) return;
    const parts = splitName(sessionName);
    setFirstName(parts.first);
    setLastName(parts.last);
  }, [sessionName, nameTouched]);

  useEffect(
    () => () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const maxMb = Math.max(1, Math.round(maxBytes / (1024 * 1024)));
  const requiresPhoto = signupPath !== 'LEARNER';

  const clearSelection = () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setStagedUrl(null);
  };

  const acceptFile = (next: File | null) => {
    setPhotoError(null);
    if (!next) return;
    if (!isSupportedImage(next)) {
      clearSelection();
      setPhotoError(tPhotoErrors('pictureWrongType'));
      return;
    }
    if (next.size === 0 || next.size > maxBytes) {
      clearSelection();
      setPhotoError(
        next.size === 0
          ? tPhotoErrors('pictureUploadFailed')
          : learnerPhoto
            ? tPhotoErrors('pictureTooLargeLearner')
            : tPhotoErrors('pictureTooLarge'),
      );
      return;
    }
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
  };

  const removePhoto = () => {
    clearSelection();
    setPhotoError(null);
  };

  const confirmStaged = async (): Promise<string> => {
    const response = await apiFetch('/api/profile/picture/confirm', {
      method: 'POST',
      body: JSON.stringify({}),
      schema: PhotoConfirmationResponse,
    });
    return response.imageUrl;
  };

  const submit = async () => {
    if (submitting) return;
    const first = firstName.trim();
    const last = lastName.trim();
    if (!first && last) {
      setNameError(t('firstNameError'));
      return;
    }
    setNameError(null);

    const hasPhoto = Boolean(file || stagedUrl);
    if (requiresPhoto && !hasPhoto) {
      setPhotoError(tPhotoErrors('pictureRequired'));
      return;
    }
    setPhotoError(null);
    setSubmitting(true);

    try {
      // 1. Photo: stage the picked file, then confirm (same two-call
      //    contract as before — the wizard state machine reads CONFIRMED).
      if (file) {
        const fd = new FormData();
        fd.append('file', file, file.name || 'photo');
        const response = await fetch('/api/profile/picture', {
          method: 'POST',
          body: fd,
          credentials: 'include',
        });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error('photo upload failed', { cause: body });
        const uploaded = PhotoUploadResponse.parse(body);
        setStagedUrl(uploaded.imageUrl);
        await confirmStaged();
      } else if (stagedUrl) {
        await confirmStaged();
      }

      // 2. Name: better-auth stores one `name` — combine the split fields.
      //    Non-blocking: a failed save shouldn't trap the user on this step.
      const combined = [first, last].filter(Boolean).join(' ');
      if (combined && combined !== originalName) {
        try {
          const { error } = await authClient.updateUser({ name: combined });
          if (error) toast.error(t('nameUpdateFailed'));
        } catch {
          toast.error(t('nameUpdateFailed'));
        }
      }

      // 3. Product updates: only opt-IN writes a consent row here — signup
      //    already recorded marketing:false at the account step.
      if (subscribe) {
        try {
          await apiFetch('/api/consent', {
            method: 'POST',
            body: JSON.stringify({
              policyVersion: PRIVACY_POLICY_VERSION,
              scope: { essential: true, analytics: false, marketing: true },
              source: 'signup',
            }),
          });
        } catch {
          // best-effort
        }
      }

      onContinue();
    } catch (err) {
      const detail = extractServerMessage(err instanceof Error ? err.cause : undefined);
      const message = detail ?? tPhotoErrors('pictureUploadFailed');
      setPhotoError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="profile-details-step grid gap-10 lg:grid-cols-2 lg:gap-14">
      <div className="grid content-start gap-7">
        <div className="grid gap-2">
          <p className="text-small font-medium text-muted-foreground">
            {stepCurrent}/{stepTotal}
          </p>
          <h1 className="font-display text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {t('title')}
          </h1>
        </div>

        <section className="grid gap-3">
          <h2 className="text-base font-semibold text-foreground">{t('pictureLabel')}</h2>
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                setDragOver(false);
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                acceptFile(event.dataTransfer.files[0] ?? null);
              }}
              className={`relative flex size-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors ${
                dragOver
                  ? 'border-brand-500 bg-brand-100 dark:bg-brand-900'
                  : 'border-border bg-muted hover:border-brand-500'
              }`}
              aria-label={tPhoto('placeholderAria')}
            >
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-brand-700">
                  {initialLetter(firstName || originalName)}
                </span>
              )}
            </button>
            <div className="grid gap-2">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inputRef.current?.click()}
                  disabled={submitting}
                >
                  <Upload aria-hidden />
                  {t('replaceImage')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={removePhoto}
                  disabled={submitting || (!file && !stagedUrl && !previewUrl)}
                >
                  {t('removeImage')}
                </Button>
              </div>
              <p className="text-caption text-muted-foreground">{t('imageHint', { max: maxMb })}</p>
            </div>
          </div>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
            className="sr-only"
            onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
          />
          {photoError ? (
            <p className="text-small text-destructive" role="alert">
              {photoError}
            </p>
          ) : null}
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor={`${inputId}-first`}>{t('firstNameLabel')}</Label>
            <Input
              id={`${inputId}-first`}
              className="auth-input h-12"
              autoComplete="given-name"
              placeholder={t('firstNamePlaceholder')}
              value={firstName}
              onChange={(event) => {
                setNameTouched(true);
                setFirstName(event.target.value);
                setNameError(null);
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${inputId}-last`}>{t('lastNameLabel')}</Label>
            <Input
              id={`${inputId}-last`}
              className="auth-input h-12"
              autoComplete="family-name"
              placeholder={t('lastNamePlaceholder')}
              value={lastName}
              onChange={(event) => {
                setNameTouched(true);
                setLastName(event.target.value);
                setNameError(null);
              }}
            />
          </div>
          {nameError ? (
            <p className="text-small text-destructive sm:col-span-2" role="alert">
              {nameError}
            </p>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor={`${inputId}-email`}>{t('emailLabel')}</Label>
          <Input
            id={`${inputId}-email`}
            type="email"
            readOnly
            disabled
            value={sessionEmail}
            className="auth-input h-12 opacity-70"
          />
          <p className="text-caption text-muted-foreground">{t('emailHelp')}</p>
        </div>

        <div className="border-t border-border pt-5">
          <div className="flex items-center justify-between gap-4">
            <div className="grid gap-1">
              <Label htmlFor={`${inputId}-subscribe`} className="font-medium text-foreground">
                {t('subscribeLabel')}
              </Label>
              <p className="text-small text-muted-foreground">{t('subscribeDesc')}</p>
            </div>
            <Switch
              id={`${inputId}-subscribe`}
              checked={subscribe}
              onCheckedChange={(checked) => setSubscribe(checked === true)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid gap-3">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? t('submitting') : t('continue')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={onBack}
            disabled={submitting}
          >
            {t('back')}
          </Button>
        </div>
      </div>

      <ProfilePreview
        firstName={firstName}
        lastName={lastName}
        previewUrl={previewUrl}
        signupPath={signupPath}
      />
    </div>
  );
}

function ProfilePreview({
  firstName,
  lastName,
  previewUrl,
  signupPath,
}: {
  firstName: string;
  lastName: string;
  previewUrl: string | null;
  signupPath: SignupPathType | null;
}) {
  const t = useTranslations('auth.signUp.step.profile.preview');
  const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
  const roleKey =
    signupPath === 'INSTRUCTOR'
      ? 'roleInstructor'
      : signupPath === 'SCHOOL'
        ? 'roleSchool'
        : 'roleLearner';

  return (
    <aside className="hidden lg:block" aria-hidden="true">
      <div className="sticky top-10 overflow-hidden rounded-2xl border border-border bg-card shadow-md">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex size-5 items-center justify-center rounded-md bg-brand-600 text-[10px] font-bold text-white">
            D
          </span>
          <span className="font-display text-sm font-semibold text-foreground">DriveLinkUp</span>
        </div>
        <div className="grid gap-4 p-5">
          <p className="text-eyebrow text-muted-foreground">{t('caption')}</p>
          <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-4 shadow-sm">
            <span className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-100 text-sm font-bold text-brand-700">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                initialLetter(fullName)
              )}
            </span>
            <span className="grid min-w-0 gap-1">
              <span className="truncate text-base font-semibold text-foreground">
                {fullName || '…'}
              </span>
              <span className="w-fit rounded-full bg-brand-50 px-2 py-0.5 text-caption font-medium text-brand-700">
                {t(roleKey)}
              </span>
            </span>
          </div>
          <div className="grid gap-2 rounded-xl border border-border bg-background p-4">
            <div className="h-2 w-3/4 animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-1/2 animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-2/3 animate-pulse rounded-full bg-muted" />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="grid flex-1 gap-1.5">
                <span className="h-2 w-1/2 animate-pulse rounded-full bg-muted" />
                <span className="h-2 w-1/3 animate-pulse rounded-full bg-muted" />
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
              <span className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
              <span className="grid flex-1 gap-1.5">
                <span className="h-2 w-2/5 animate-pulse rounded-full bg-muted" />
                <span className="h-2 w-1/4 animate-pulse rounded-full bg-muted" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function splitName(fullName: string): { first: string; last: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { first: '', last: '' };
  const separator = trimmed.indexOf(' ');
  if (separator === -1) return { first: trimmed, last: '' };
  return {
    first: trimmed.slice(0, separator),
    last: trimmed.slice(separator + 1).trim(),
  };
}

function initialLetter(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function isSupportedImage(file: File): boolean {
  const extension = fileExtension(file.name);
  if (REJECTED_EXTENSIONS.has(extension)) return false;
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return true;
  return (
    (file.type === '' || file.type === 'application/octet-stream' || file.type === 'image/*') &&
    SUPPORTED_EXTENSIONS.has(extension)
  );
}

function extractServerMessage(cause: unknown): string | null {
  if (!cause || typeof cause !== 'object') return null;
  const error = (cause as { error?: unknown }).error;
  if (
    error &&
    typeof error === 'object' &&
    typeof (error as { message?: unknown }).message === 'string'
  )
    return (error as { message: string }).message;
  return null;
}
