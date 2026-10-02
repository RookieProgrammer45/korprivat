import type { MarketplaceRole } from '@/lib/contracts/clickwrap';

/** Visual identity for dashboard chrome (badge + header title). */
export type DashboardShellRole = 'learner' | 'instructor' | 'school' | 'admin';

/**
 * Derive shell chrome role. Membership wins over profile; providers share
 * instructor chrome; admin is last among non-school users.
 */
export function deriveDashboardShellRole(input: {
  isSchoolOwner: boolean;
  role: MarketplaceRole;
  isAdmin: boolean;
}): DashboardShellRole {
  if (input.isSchoolOwner) return 'school';
  if (input.role === 'INSTRUCTOR' || input.role === 'HANDLEDARE') return 'instructor';
  if (input.isAdmin) return 'admin';
  return 'learner';
}
