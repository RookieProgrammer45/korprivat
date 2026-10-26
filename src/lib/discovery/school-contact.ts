// Public school contact for directory listings. The contact button is the
// school's email for every school that has one, then the school's own page.
// The phone number is not a button: callers list it with the other facts.
// Never a DriveLinkUp form, never a booking request. The address stays off
// the public JSON contract — only a mailto href is returned.

export type SchoolContactKind = 'inbox' | 'website';

export type SchoolContact = {
  kind: SchoolContactKind;
  href: string;
};

type ContactInput = {
  providerRole?: string | null;
  email?: string | null;
  bio?: string | null;
  // Address read off the school's own website, used when the listing has none.
  inbox?: string | null;
};

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;
const URL_RE = /https?:\/\/[^\s<>"'()]+/gi;
const BIO_EMAIL_RE = /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i;
const MAILTO_RE = /mailto:([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;

export function resolveSchoolContact(input: ContactInput): SchoolContact | null {
  if (input.providerRole !== 'SCHOOL') return null;
  return inboxContact(input) ?? websiteContact(input.bio);
}

// Where a learner asks a school without website prices for its prices: the
// same inbox as the contact button (the button pre-fills the message), else
// the school's site. The phone number stays in the school information.
export function resolvePriceRequest(input: ContactInput): SchoolContact | null {
  if (input.providerRole !== 'SCHOOL') return null;
  return inboxContact(input) ?? websiteContact(input.bio);
}

export function phoneFact(
  phone: { display: string; e164: string } | null | undefined,
): { display: string; href: string } | null {
  if (!phone || !/^\+46\d{7,9}$/.test(phone.e164)) return null;
  const display = phone.display.trim();
  if (!display || display.length > 40) return null;
  return { display, href: `tel:${phone.e164}` };
}

function inboxContact(input: ContactInput): SchoolContact | null {
  const inbox =
    normalizeEmail(input.email) ?? emailFromBio(input.bio) ?? normalizeEmail(input.inbox);
  return inbox ? { kind: 'inbox', href: `mailto:${inbox}` } : null;
}

function websiteContact(bio: string | null | undefined): SchoolContact | null {
  const website = firstWebsite(bio);
  return website ? { kind: 'website', href: website } : null;
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
