import type { MarketplaceRole } from '@/lib/contracts/clickwrap';

export type DashboardNavItemSpec = {
  href: string;
  /** Translation key under `dashboard.nav.*` (without the `nav.` prefix used by useTranslations). */
  labelKey:
    | 'overviewTab'
    | 'studentTab'
    | 'instructorTab'
    | 'handledareTab'
    | 'availabilityTab'
    | 'revenueTab'
    | 'messagesTab'
    | 'schoolOverviewTab'
    | 'schoolInstructorsTab'
    | 'schoolBookingsTab'
    | 'schoolRevenueTab'
    | 'schoolSettingsTab';
};

/**
 * Pure nav membership for dashboard chrome. Label strings resolve via i18n;
 * this list is what each role sees.
 */
export function buildDashboardNavItems(input: {
  role: MarketplaceRole;
  isSchoolOwner: boolean;
}): DashboardNavItemSpec[] {
  if (input.isSchoolOwner) {
    return [
      { href: '/dashboard/school', labelKey: 'schoolOverviewTab' },
      { href: '/dashboard/school#instructors', labelKey: 'schoolInstructorsTab' },
      { href: '/dashboard/school#bookings', labelKey: 'schoolBookingsTab' },
      { href: '/dashboard/school/revenue', labelKey: 'schoolRevenueTab' },
      { href: '/dashboard/school/settings', labelKey: 'schoolSettingsTab' },
    ];
  }

  const items: DashboardNavItemSpec[] = [];

  if (input.role === 'INSTRUCTOR' || input.role === 'HANDLEDARE') {
    items.push({ href: '/dashboard', labelKey: 'overviewTab' });
  }
  if (input.role === 'STUDENT') {
    items.push({ href: '/dashboard/student', labelKey: 'studentTab' });
  }
  if (input.role === 'INSTRUCTOR') {
    items.push({ href: '/dashboard/instructor', labelKey: 'instructorTab' });
  }
  if (input.role === 'HANDLEDARE') {
    items.push({ href: '/dashboard/handledare', labelKey: 'handledareTab' });
  }
  if (input.role === 'INSTRUCTOR') {
    items.push(
      { href: '/dashboard/instructor/availability', labelKey: 'availabilityTab' },
      { href: '/dashboard/instructor/revenue', labelKey: 'revenueTab' },
    );
  }
  if (input.role === 'HANDLEDARE') {
    items.push({
      href: '/dashboard/handledare/availability',
      labelKey: 'availabilityTab',
    });
  }
  if (input.role !== 'HANDLEDARE') {
    items.push({ href: '/dashboard/messages', labelKey: 'messagesTab' });
  }

  return items;
}
