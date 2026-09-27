// Prefers Vercel Blob (BLOB_READ_WRITE_TOKEN). Falls back to the legacy Polsia
// R2 proxy only when a POLSIA_API_KEY is present so local/prod deploys keep
// working after disconnecting from Polsia.

import 'server-only';
import { put } from '@vercel/blob';
import FormDataNode from 'form-data';
import nodeFetch from 'node-fetch';

const R2_UPLOAD_URL = 'https://polsia.com/api/proxy/r2/upload';

export type StoredObject = {
  url: string;
  key: string;
  mime: string;
  size: number;
};

type R2Response =
  | { success: true; file: { key: string; url: string } }
  | { success: false; error?: { code?: string; message?: string } };

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

async function uploadViaPolsiaR2(
  file: File,
  filename: string,
  contentType: string,
): Promise<StoredObject> {
  const apiKey = process.env.POLSIA_API_KEY;
  if (!apiKey) {
    throw new ObjectStorageError('upload_failed', 'No object storage configured');
  }
  const r2Form = new FormDataNode();
  r2Form.append('file', Buffer.from(await file.arrayBuffer()), {
    filename,
    contentType,
  });
  const response = await nodeFetch(R2_UPLOAD_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...r2Form.getHeaders(),
    },
    body: r2Form,
  });
  const result = (await response.json()) as R2Response;
  if (!response.ok || !result.success) {
    const code = result.success ? 'upload_failed' : (result.error?.code ?? 'upload_failed');
    const message = result.success ? 'Upload failed' : (result.error?.message ?? 'Upload failed');
    throw new ObjectStorageError(code, message);
  }
  return {
    url: result.file.url,
    key: result.file.key,
    mime: contentType,
    size: file.size,
  };
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

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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

  try {
    return await uploadViaPolsiaR2(file, filename, contentType);
  } catch (error) {
    if (error instanceof ObjectStorageError) throw error;
    throw new ObjectStorageError(
      'upload_failed',
      error instanceof Error ? error.message : 'Upload failed',
    );
  }
}
