
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';
import { requireDashboardSession } from '@/lib/dashboard-guard';
import { listMembershipsForUser } from '@/lib/orgs/service';
import { requireSignupPrerequisites } from '@/lib/signup-resume';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireDashboardSession('/dashboard');
  await requireSignupPrerequisites(session.userId, session.role);
  const t = await getTranslations('dashboard');

  const memberships = await listMembershipsForUser(session.userId, { onlyActive: true });
  const isSchoolOwner = memberships.some((m) => m.role === 'OWNER' || m.role === 'STAFF');

  return (
    <DashboardShell
      role={session.role}
      isAdmin={session.isAdmin}
      userLabel={t('signedInAs', { name: session.name })}
      isSchoolOwner={isSchoolOwner}
    >
      {children}
    </DashboardShell>
  );
}
