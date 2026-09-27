'use client';

import Image from 'next/image';
import { useEffect, useId, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { apiFetch } from '@/lib/api-client';
import { PhotoConfirmationResponse, PhotoUploadResponse } from '@/lib/contracts/photo-verification';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const REJECTED_EXTENSIONS = new Set(['.heic', '.heif']);

export type PhotoPromptCopy = {
  eyebrow: string;
  title: string;
  lead: string;
  placeholderAria: string;
  chooseButton: string;
  dragHint: string;
  submit: string;
  submitting: string;
  confirm: string;
  confirming: string;
  confirmationLabel: string;
  staged: string;
  back?: string;
  whyWeAsk?: string;
  errors: {
    pictureRequired: string;
    pictureWrongType: string;
    pictureTooLarge: string;
    pictureUploadFailed: string;
    proxyFailure?: string;
  };
};

type PhotoPromptStepProps = {
  endpoint: '/api/profile/picture' | '/api/instructors/photo';
  fieldName: 'file' | 'photo';
  initialName?: string;
  initialStagedUrl?: string | null;
  onConfirmed: (url: string) => void;
  onBack?: () => void;
  /** Optional skip — used for LEARNER signup profile photo. */
  allowSkip?: boolean;
  onSkip?: () => void;
  skipLabel?: string;
  /** Default 20 MB; LEARNER signup uses 5 MB. */
  maxBytes?: number;
  /** After a successful stage, confirm immediately (LEARNER). */
  autoConfirmOnUpload?: boolean;
  copy: PhotoPromptCopy;
};

export function PhotoPromptStep({
  endpoint,
  fieldName,
  initialName,
  initialStagedUrl,
  onConfirmed,
  onBack,
  allowSkip = false,
  onSkip,
  skipLabel,
  maxBytes = MAX_IMAGE_BYTES,
  autoConfirmOnUpload = false,
  copy,
}: PhotoPromptStepProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialStagedUrl ?? null);
  const [stagedUrl, setStagedUrl] = useState<string | null>(initialStagedUrl ?? null);
  const [confirmed, setConfirmed] = useState(false);
  const [confirmationChecked, setConfirmationChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(
    () => () => {
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const acceptFile = (next: File | null) => {
    setError(null);
    if (!next) return;
    if (!isSupportedImage(next)) {
      clearLocalSelection(initialStagedUrl, previewUrl, setFile, setPreviewUrl, setStagedUrl);
      setError(copy.errors.pictureWrongType);
      return;
    }
    if (next.size === 0 || next.size > maxBytes) {
      clearLocalSelection(initialStagedUrl, previewUrl, setFile, setPreviewUrl, setStagedUrl);
      setError(next.size === 0 ? copy.errors.pictureUploadFailed : copy.errors.pictureTooLarge);
      return;
    }
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setFile(next);
    setPreviewUrl(URL.createObjectURL(next));
    setStagedUrl(null);
    setConfirmed(false);
    setConfirmationChecked(false);
  };

  const confirmStaged = async (url: string) => {
    const response = await apiFetch('/api/profile/picture/confirm', {
      method: 'POST',
      body: JSON.stringify({}),
      schema: PhotoConfirmationResponse,
    });
    setConfirmed(true);
    onConfirmed(response.imageUrl || url);
  };

  const submit = async () => {
    if (!file) {
      setError(copy.errors.pictureRequired);
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append(fieldName, file, file.name || 'photo');
      const response = await uploadPicture(endpoint, fd);
      setStagedUrl(response.imageUrl);
      setConfirmed(false);
      setConfirmationChecked(false);
      setError(null);
      if (autoConfirmOnUpload) {
        await confirmStaged(response.imageUrl);
      }
    } catch (err) {
      const detail =
        extractServerMessage(err instanceof Error ? err.cause : undefined) ??
        copy.errors.proxyFailure ??
        copy.errors.pictureUploadFailed;
      setError(detail);
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  const confirm = async () => {
    if (!stagedUrl) {
      setError(copy.errors.pictureRequired);
      return;
    }
    setSubmitting(true);
    try {
      await confirmStaged(stagedUrl);
    } catch (err) {
      const detail =
        extractServerMessage(err instanceof Error ? err.cause : undefined) ??
        copy.errors.pictureUploadFailed;
      setError(detail);
      toast.error(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-5">
      <div className="grid gap-1">
        <p className="text-eyebrow text-muted-foreground">{copy.eyebrow}</p>
        <p className="text-h4 text-foreground">{copy.title}</p>
        <p className="text-body text-muted-foreground">{copy.lead}</p>
      </div>
      <div className="flex flex-col items-center gap-4">
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
          className={`relative flex h-44 w-44 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed transition-colors sm:h-52 sm:w-52 ${dragOver ? 'border-brand-500 bg-brand-100 dark:bg-brand-900' : 'border-border bg-muted hover:border-brand-500'}`}
          aria-label={copy.placeholderAria}
        >
          {previewUrl ? (
            <Image
              src={previewUrl}
              alt=""
              fill
              sizes="208px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <span className="flex flex-col items-center gap-1 text-center">
              <span className="text-h2 font-bold text-brand-700">{initialLetter(initialName)}</span>
              <span className="px-4 text-caption text-muted-foreground">{copy.dragHint}</span>
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
          className="sr-only"
          onChange={(event) => acceptFile(event.target.files?.[0] ?? null)}
        />
        <Button
          type="button"
          variant={file ? 'outline' : 'secondary'}
          onClick={() => inputRef.current?.click()}
          disabled={submitting}
        >
          {copy.chooseButton}
        </Button>
        {stagedUrl ? (
          <p className="text-small text-brand-700 dark:text-brand-300" aria-live="polite">
            {confirmed ? copy.confirmationLabel : copy.staged}
          </p>
        ) : null}
        {stagedUrl && !confirmed && !autoConfirmOnUpload ? (
          <label
            htmlFor={`${inputId}-confirm`}
            className="flex max-w-sm items-start gap-2 text-small text-foreground"
          >
            <Checkbox
              id={`${inputId}-confirm`}
              checked={confirmationChecked}
              onCheckedChange={(checked) => setConfirmationChecked(checked === true)}
            />
            <span>{copy.confirmationLabel}</span>
          </label>
        ) : null}
        {error ? (
          <p className="text-small text-center text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {copy.whyWeAsk ? (
          <p className="max-w-sm text-center text-caption text-muted-foreground">{copy.whyWeAsk}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
        {onBack ? (
          <Button type="button" variant="ghost" onClick={onBack} disabled={submitting}>
            {copy.back ?? 'Back'}
          </Button>
        ) : (
          <span aria-hidden="true" />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          {allowSkip ? (
            <Button type="button" variant="ghost" onClick={onSkip} disabled={submitting}>
              {skipLabel ?? 'Skip'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant={stagedUrl && !autoConfirmOnUpload ? 'outline' : 'default'}
            onClick={submit}
            disabled={submitting || !file}
          >
            {submitting && !stagedUrl ? copy.submitting : copy.submit}
          </Button>
          {!autoConfirmOnUpload ? (
            <Button
              type="button"
              onClick={confirm}
              disabled={submitting || !stagedUrl || !confirmationChecked || confirmed}
            >
              {submitting && stagedUrl ? copy.confirming : copy.confirm}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function clearLocalSelection(
  staged: string | null | undefined,
  preview: string | null,
  setFile: (file: File | null) => void,
  setPreview: (url: string | null) => void,
  setStaged: (url: string | null) => void,
) {
  if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
  setFile(null);
  setPreview(staged ?? null);
  setStaged(staged ?? null);
}

function initialLetter(name?: string): string {
  return name?.trim().charAt(0).toUpperCase() || '?';
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

async function uploadPicture(endpoint: string, fd: FormData): Promise<PhotoUploadResponse> {
  const response = await fetch(endpoint, { method: 'POST', body: fd, credentials: 'include' });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error('photo upload failed', { cause: body });
  return PhotoUploadResponse.parse(body);
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
