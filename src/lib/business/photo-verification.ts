import 'server-only';
import { ObjectStorageError, storeUserUpload } from '@/lib/business/object-storage';
import { prisma } from '@/lib/db';

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const REJECTED_EXTENSIONS = new Set(['.heic', '.heif']);

export type PhotoValidationError = 'unsupported_image_format' | 'file_too_large' | 'empty_file';

export function validatePhoto(
  file: File,
): { ok: true } | { ok: false; code: PhotoValidationError } {
  if (file.size === 0) return { ok: false, code: 'empty_file' };
  if (file.size > MAX_IMAGE_BYTES) return { ok: false, code: 'file_too_large' };
  const extension = fileExtension(file.name);
  if (REJECTED_EXTENSIONS.has(extension)) return { ok: false, code: 'unsupported_image_format' };
  if (SUPPORTED_MIME_TYPES.has(file.type.toLowerCase())) return { ok: true };
  if (
    (file.type === '' || file.type === 'application/octet-stream' || file.type === 'image/*') &&
    SUPPORTED_EXTENSIONS.has(extension)
  ) {
    return { ok: true };
  }
  return { ok: false, code: 'unsupported_image_format' };
}

export type PhotoUpload = { url: string; key: string; mime: string; size: number };

export class PhotoUploadError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export async function uploadPhoto(file: File): Promise<PhotoUpload> {
  const validation = validatePhoto(file);
  if (!validation.ok) throw new PhotoUploadError(validation.code, validation.code);
  try {
    const stored = await storeUserUpload(file, {
      folder: 'photos',
      contentType: normalizedMimeType(file),
      filename: file.name || 'photo',
    });
    return stored;
  } catch (error) {
    if (error instanceof PhotoUploadError) throw error;
    if (error instanceof ObjectStorageError) {
      throw new PhotoUploadError(error.code, error.message);
    }
    throw new PhotoUploadError(
      'upload_failed',
      error instanceof Error ? error.message : 'Upload failed',
    );
  }
}

export async function stagePhoto(
  userId: string,
  file: File,
): Promise<{ imageUrl: string; stagedAt: Date }> {
  const uploaded = await uploadPhoto(file);
  const stagedAt = new Date();
  await prisma.photoVerification.upsert({
    where: { userId },
    create: {
      userId,
      stagedUrl: uploaded.url,
      stagedKey: uploaded.key,
      stagedAt,
      status: 'STAGED',
    },
    update: {
      stagedUrl: uploaded.url,
      stagedKey: uploaded.key,
      stagedAt,
      status: 'STAGED',
      confirmedAt: null,
    },
  });
  return { imageUrl: uploaded.url, stagedAt };
}

export async function confirmPhoto(userId: string): Promise<{
  imageUrl: string;
  confirmedAt: Date;
  profileCompletedAt: Date;
}> {
  const [verification, user] = await Promise.all([
    prisma.photoVerification.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { image: true } }),
  ]);
  const imageUrl = verification?.stagedUrl ?? user?.image;
  if (!imageUrl)
    throw new PhotoUploadError('photo_not_staged', 'Upload a photo before confirming it.');
  if (verification?.status === 'CONFIRMED' && verification.confirmedAt) {
    return {
      imageUrl,
      confirmedAt: verification.confirmedAt,
      profileCompletedAt: verification.confirmedAt,
    };
  }
  const confirmedAt = new Date();
  await prisma.user.update({ where: { id: userId }, data: { image: imageUrl } });
  await prisma.photoVerification.upsert({
    where: { userId },
    create: { userId, stagedUrl: imageUrl, confirmedAt, status: 'CONFIRMED' },
    update: { stagedUrl: imageUrl, confirmedAt, status: 'CONFIRMED' },
  });
  await prisma.userProfile.upsert({
    where: { userId },
    create: { userId, profileCompletedAt: confirmedAt },
    update: { profileCompletedAt: confirmedAt },
  });
  return { imageUrl, confirmedAt, profileCompletedAt: confirmedAt };
}

export async function confirmedPhotoUrl(userId: string): Promise<string | null> {
  const [verification, user] = await Promise.all([
    prisma.photoVerification.findUnique({
      where: { userId },
      select: { stagedUrl: true, status: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { image: true } }),
  ]);
  if (verification?.status === 'CONFIRMED' && verification.stagedUrl) return verification.stagedUrl;
  return user?.image ?? null;
}

export async function photoState(userId: string) {
  const [verification, user] = await Promise.all([
    prisma.photoVerification.findUnique({
      where: { userId },
      select: { stagedUrl: true, status: true, confirmedAt: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { image: true } }),
  ]);
  const isConfirmed = verification?.status === 'CONFIRMED';
  return {
    status: isConfirmed ? 'CONFIRMED' : verification?.stagedUrl ? 'STAGED' : 'NONE',
    imageUrl: verification?.stagedUrl ?? user?.image ?? null,
    confirmedAt: verification?.confirmedAt?.toISOString() ?? null,
  } as const;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function normalizedMimeType(file: File): string {
  const mime = file.type.toLowerCase();
  if (SUPPORTED_MIME_TYPES.has(mime)) return mime;
  const extension = fileExtension(file.name);
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.gif') return 'image/gif';
  return 'image/webp';
}
