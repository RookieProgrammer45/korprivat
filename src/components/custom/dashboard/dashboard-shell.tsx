'use client';

import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Separator } from '@/components/ui/separator';
import { useSession } from '@/lib/auth-client';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { SignupConfirmationBanner } from '../signup-confirmation-banner';
import { DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  children: ReactNode;
  role: MarketplaceRole;
  isAdmin: boolean;
  userLabel: string;
}

function hasRole(role: string | null | undefined, expected: string) {
  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes(expected) ?? false
  );
}

export function DashboardShell({ children, role, isAdmin, userLabel }: DashboardShellProps) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const t = useTranslations('dashboard.shell');
  const hasAdminRole = hasRole(session?.user?.role, 'admin');

  useEffect(() => {
    if (!isPending && !session?.user) {
      router.replace('/login');
    }
  }, [isPending, router, session?.user]);

  if (isPending) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-gutter">
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      </main>
    );
  }

  if (!session?.user) {
    // The effect above redirects to /login; this is the brief transition state,
    // not a stable screen.
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-gutter">
        <p className="text-sm text-muted-foreground">{t('redirecting')}</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-border/70 bg-background">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-gutter">
            <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                <LayoutDashboard aria-hidden="true" className="size-4" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">{t('brand')}</span>
            </Link>
            <span className="hidden text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground sm:block">
              {hasAdminRole ? t('adminAccess') : t('marketplace')}
            </span>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-gutter py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-border/70 lg:pr-6">
            <DashboardNav role={role} isAdmin={isAdmin} userLabel={userLabel} />
          </aside>

          <section className="min-w-0">
            <SignupConfirmationBanner />
            <Separator className="mb-6" />
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
