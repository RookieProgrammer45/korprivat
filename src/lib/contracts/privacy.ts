// @polsia:user-owned — privacy / consent constants single-sourced here so the
// auth contract, the consent banner, and the server-side route handler all
// stamp the same `policyVersion`.

/** Bump this constant when the privacy policy text changes; the consent
 *  table groups rows by policyVersion so a future GDPR-driven version bump
 *  is tracked separately per acceptance. Format: semver-ish. */
export const PRIVACY_POLICY_VERSION = 'v2026.08.0';

/** The fixed "essential" cookie scope — non-negotiable, the service cannot
 *  run without these. Re-exported so client code can render a locked toggle. */
export const CONSENT_ESSENTIAL = {
  essential: true as const,
  analytics: false as const,
  marketing: false as const,
};
