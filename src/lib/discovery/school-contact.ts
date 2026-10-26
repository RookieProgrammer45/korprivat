// Public school contact for directory listings. Inbox first, then the
// school's own page. Never a DriveLinkUp form, never a booking request.
// Email stays off the public JSON contract — only a resolved href is
// returned.

export type SchoolContactKind = 'inbox' | 'website';

export type SchoolContact = {
  kind: SchoolContactKind;
  href: string;
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const URL_RE = /https?:\/\/[^\s<>"'()]+/gi;
const BIO_EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const MAILTO_RE = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

export function resolveSchoolContact(input: {
  providerRole?: string | null;
  email?: string | null;
  bio?: string | null;
}): SchoolContact | null {
  if (input.providerRole !== 'SCHOOL') return null;

  const inbox = normalizeEmail(input.email) ?? emailFromBio(input.bio);
  if (inbox) return { kind: 'inbox', href: `mailto:${inbox}` };

  const website = firstWebsite(input.bio);
  if (website) return { kind: 'website', href: website };

  return null;
}

function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (trimmed.length < 5 || trimmed.length > 254) return null;
  if (/[\s\r\n,]/.test(raw) || /[\s\r\n,]/.test(trimmed)) return null;
  if (!EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

function emailFromBio(bio: string | null | undefined): string | null {
  if (typeof bio !== 'string') return null;
  const mailto = bio.match(MAILTO_RE);
  if (mailto?.[1]) return normalizeEmail(mailto[1]);
  const plain = bio.match(BIO_EMAIL_RE);
  return normalizeEmail(plain?.[0]);
}

function firstWebsite(bio: string | null | undefined): string | null {
  if (typeof bio !== 'string') return null;
  const matches = bio.match(URL_RE) ?? [];
  for (const raw of matches) {
    const cleaned = raw.replace(/[.,;:!?)]+$/, '');
    try {
      const url = new URL(cleaned);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue;
      if (url.username || url.password) continue;
      const host = url.hostname.toLowerCase();
      if (host === 'localhost' || host.endsWith('.local')) continue;
      return url.href;
    } catch {
      // skip malformed URL
    }
  }
  return null;
}
