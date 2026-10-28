//
// Public "claim this school" deep-link. Owners reach DriveLinkUp through
// the existing /contact form — this is not the flagged ACQ-1 claim funnel
// and does not grant listing control, verification, or booking scopes.

const LISTING_MAX = 200;
const NAME_MAX = 120;
const LISTING_PATH = /^\/(trafikskola|schools)\/[A-Za-z0-9._~/-]+$/;

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 32) return true;
  }
  return false;
}

export function parseClaimListingPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const path = raw.trim();
  if (!path || path.length > LISTING_MAX) return null;
  if (path.includes('..') || path.includes('\\') || path.includes('://') || path.includes('//')) {
    return null;
  }
  if (path.includes('?') || path.includes('#') || hasControlChars(path)) return null;
  return LISTING_PATH.test(path) ? path : null;
}

export function parseClaimSchoolName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name || name.length > NAME_MAX) return null;
  if (hasControlChars(name)) return null;
  return name;
}

export function claimListingHref(input: { name: string; listing: string }): string {
  const params = new URLSearchParams({ topic: 'claim_listing' });
  const name = parseClaimSchoolName(input.name);
  const listing = parseClaimListingPath(input.listing);
  if (name) params.set('school', name);
  if (listing) params.set('listing', listing);
  return `/contact?${params.toString()}`;
}
