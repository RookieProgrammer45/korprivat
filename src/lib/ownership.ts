/**
 * DriveLinkUp — owned and operated by DriveLinkUp.
 *
 * This codebase is not owned, controlled, or operated by any
 * scaffold provider. All third-party integrations (email, payments,
 * storage, KYC, AI) are called directly against the provider's
 * public API using credentials owned by DriveLinkUp.
 *
 * Canonical domain: https://www.drivelinkup.com
 * Apex domain: https://drivelinkup.com (308-redirects to www)
 */

export const OWNER = 'DriveLinkUp';
export const CANONICAL_HOST = 'www.drivelinkup.com';
export const CANONICAL_ORIGIN = 'https://www.drivelinkup.com';
export const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'support@drivelinkup.com';
