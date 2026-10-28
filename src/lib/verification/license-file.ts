const LICENSE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function licenseFileAccepted(
  mimeType: string,
  sizeBytes: number,
  maxImageBytes: number,
  maxPdfBytes: number,
): { ok: true } | { ok: false; reason: string } {
  if (LICENSE_IMAGE_TYPES.has(mimeType)) {
    if (sizeBytes > maxImageBytes) return { ok: false, reason: 'licenseTooLarge' };
    return { ok: true };
  }
  if (mimeType === 'application/pdf') {
    if (sizeBytes > maxPdfBytes) return { ok: false, reason: 'licenseTooLarge' };
    return { ok: true };
  }
  return { ok: false, reason: 'licenseWrongType' };
}

/** Trust the first bytes, not only the browser-supplied MIME. */
export function magicLooksLikeLicense(bytes: Uint8Array, mimeType: string): boolean {
  if (bytes.length < 12) return false;
  if (mimeType === 'application/pdf') {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mimeType === 'image/jpeg') {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  if (mimeType === 'image/webp') {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}
