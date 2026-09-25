// @polsia:user-owned

import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { DashboardShell } from '@/components/custom/dashboard/dashboard-shell';
import { requireDashboardSession } from '@/lib/dashboard-guard';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await requireDashboardSession('/dashboard');
  const t = await getTranslations('dashboard');

  return (
    <DashboardShell
      role={session.role}
      isAdmin={session.isAdmin}
      userLabel={t('signedInAs', { name: session.name })}
    >
      {children}
    </DashboardShell>
  );
}
