// Vercel Blob uploads for user photos / licence docs.
// Requires BLOB_READ_WRITE_TOKEN (Vercel Blob store).

import 'server-only';
import { put } from '@vercel/blob';

export type StoredObject = {
  url: string;
  key: string;
  mime: string;
  size: number;
};

export class ObjectStorageError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

function safeFilename(raw: string): string {
  const noSeparators = raw.replace(/[\\/]/g, '_');
  let cleaned = '';
  for (const character of noSeparators) {
    if (character.charCodeAt(0) >= 32) cleaned += character;
  }
  return cleaned.trim() || `file-${Date.now()}`;
}

/**
 * Store a user upload. `folder` scopes the pathname (e.g. `photos`, `licenses`).
 */
export async function storeUserUpload(
  file: File,
  options: { folder: string; contentType?: string; filename?: string },
): Promise<StoredObject> {
  const filename = safeFilename(options.filename || file.name || 'upload');
  const contentType = options.contentType || file.type || 'application/octet-stream';
  const pathname = `${options.folder}/${Date.now()}-${filename}`;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new ObjectStorageError('upload_failed', 'No object storage configured');
  }

  try {
    const blob = await put(pathname, file, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return {
      url: blob.url,
      key: blob.pathname,
      mime: contentType,
      size: file.size,
    };
  } catch (error) {
    throw new ObjectStorageError(
      'upload_failed',
      error instanceof Error ? error.message : 'Upload failed',
    );
  }
}
