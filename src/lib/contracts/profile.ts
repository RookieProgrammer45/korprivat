//
// Single envelope returned by GET /api/profile: the signed-in user's name/
// email/avatar + their marketplace role + the role-correct upcoming-bookings
// list. BookingList is re-imported from the auth contract so the dashboard
// and /profile parse paths stay aligned — only the wrapper differs.
//
// Why one envelope (and not separate role-conditional endpoints): the page
// needs `role` to pick the right query, and `role` is personal data the user
// has a right to see in the same response as their own list. One round trip,
// one skeleton, one parsing seam.

import { z } from 'zod';
import { BookingList } from '@/lib/contracts/auth';
import { PhotoVerificationState } from '@/lib/contracts/photo-verification';

export const MarketplaceRole = z.enum(['STUDENT', 'INSTRUCTOR', 'HANDLEDARE', 'SCHOOL']);
export type MarketplaceRole = z.infer<typeof MarketplaceRole>;

export const ProfileUser = z.object({
  name: z.string(),
  email: z.string().email(),
  // `User.image` is written by /api/profile/picture as an absolute R2 url.
  // Nullable so a user without a completed avatar upload still parses.
  image: z.string().url().nullable(),
});
export type ProfileUser = z.infer<typeof ProfileUser>;

export const Profile = z.object({
  user: ProfileUser,
  role: MarketplaceRole,
  upcoming: BookingList,
  photo: PhotoVerificationState,
});
export type Profile = z.infer<typeof Profile>;

// Response for POST /api/profile/delete — the self-service GDPR erasure.
// `deleted: true` is only returned after the full transactional erase has
// committed; the caller's session is dead by then (Session cascades with
// User), so the client signs out and redirects home.
export const DeleteAccountResponse = z.object({
  deleted: z.boolean(),
});
export type DeleteAccountResponse = z.infer<typeof DeleteAccountResponse>;
