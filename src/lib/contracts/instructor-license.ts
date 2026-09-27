//
// Both the route handler (server) and the InstructorLicenseStatusBanner
// island (client) import the SAME schemas, so a shape drift surfaces as
// a `tsc` error / runtime ZodError instead of silent drift.

import { z } from 'zod';

export const LicenseStatusEnum = z.enum(['NONE', 'PENDING', 'VERIFIED', 'REJECTED']);
export type LicenseStatusWire = z.infer<typeof LicenseStatusEnum>;

// Response from POST /api/instructor-license. The server returns the just-
// committed status (always `PENDING` on a fresh upload, the prior status on
// a re-upload) plus the public file URL and the submitted timestamp so the
// client can render a confirmation alongside the wizard's final step.
export const LicenseUploadResponse = z.object({
  status: LicenseStatusEnum,
  fileUrl: z.string().url(),
  submittedAt: z.string(),
});
export type LicenseUploadResponse = z.infer<typeof LicenseUploadResponse>;

// Response from GET /api/instructor-license. Distinct from the upload
// response because GET doesn't always have a file URL (status === NONE).
// `canUpgrade` is the HANDLEDARE-only "show me the upgrade form" bit — true
// when the viewer is a HANDLEDARE (and therefore eligible to start the
// Trafiklärare certified-instructor upgrade flow). STUDENT and INSTRUCTOR
// both get false so the dashboard doesn't offer a CTA the route will 403.
export const LicenseStatusResponse = z.object({
  status: LicenseStatusEnum,
  rejectionReason: z.string().optional(),
  submittedAt: z.string().optional(),
  canUpgrade: z.boolean(),
});
export type LicenseStatusResponse = z.infer<typeof LicenseStatusResponse>;

// POST /api/instructor-license/upgrade — the user-facing "I've already been
// verified but the role-flip code didn't run yet" idempotent fallback. The
// dashboard island calls it when GET shows status === VERIFIED but the user
// is still HANDLEDARE so that one tap pushes the role to INSTRUCTOR and the
// handledare tab stops being reachable. The admin decision endpoint runs
// the same role-flip in the same transaction, so this is the user's
// catch-up path when admin flipped the licence row before the user
// navigated there (or any time the user wants to retry the switch).
export const InstructorLicenseUpgradeResponse = z.object({
  userId: z.string(),
  role: z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE']),
  upgradedAt: z.string(),
  alreadyUpgraded: z.boolean(),
});
export type InstructorLicenseUpgradeResponse = z.infer<typeof InstructorLicenseUpgradeResponse>;

// POST /api/admin/instructor-license-decision — admin body. Either VERIFIED
// (approve) or REJECTED (decline with a free-text reason). The admin gate
// is enforced in the route handler via the same inline assertAdmin helper
// the rest of /api/admin uses.
export const InstructorLicenseAdminDecision = z.object({
  userId: z.string().min(1),
  status: z.enum(['VERIFIED', 'REJECTED']),
  rejectionReason: z.string().max(2000).optional(),
});
export type InstructorLicenseAdminDecision = z.infer<typeof InstructorLicenseAdminDecision>;

// Single row in the admin pending list. Joined from `User` by `userId`
// (no Prisma @relation — User is framework-owned) so the admin can see
// the email + name of the applicant alongside the licence row.
export const InstructorLicenseAdminRow = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string(),
  fileUrl: z.string(),
  fileMime: z.string(),
  fileSizeBytes: z.number().int().nonnegative(),
  submittedAt: z.string(),
  attestation: z.boolean(),
});
export type InstructorLicenseAdminRow = z.infer<typeof InstructorLicenseAdminRow>;

// GET /api/admin/instructor-license-decisions — list of pending rows for
// the admin table. Ordered by submittedAt ascending so the oldest request
// bubbles up first (FIFO-ish review queue).
export const InstructorLicenseAdminList = z.object({
  items: z.array(InstructorLicenseAdminRow),
});
export type InstructorLicenseAdminList = z.infer<typeof InstructorLicenseAdminList>;
