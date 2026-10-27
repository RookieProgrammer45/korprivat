'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { useSession } from '@/lib/auth-client';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import type { DashboardShellRole } from '@/lib/dashboard-shell-role';
import { siteName } from '@/lib/site';
import { cn } from '@/lib/utils';
import { SignupConfirmationBanner } from '../signup-confirmation-banner';
import { DashboardNav } from './dashboard-nav';

export interface DashboardShellProps {
  children: ReactNode;
  role: MarketplaceRole;
  isAdmin: boolean;
  userLabel: string;
  /** ACTIVE OWNER or STAFF Membership — drives school sidebar. */
  isSchoolOwner?: boolean;
  /** Chrome identity: role badge. */
  shellRole: DashboardShellRole;
}

function hasRole(role: string | null | undefined, expected: string) {
  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes(expected) ?? false
  );
}

const BADGE_TINT: Record<DashboardShellRole, string> = {
  learner:
    'border-teal-500/25 bg-teal-500/10 text-teal-800 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-200',
  instructor:
    'border-blue-500/25 bg-blue-500/10 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200',
  school:
    'border-stone-500/25 bg-stone-500/10 text-stone-800 dark:border-stone-400/30 dark:bg-stone-400/10 dark:text-stone-200',
  admin:
    'border-red-500/25 bg-red-500/10 text-red-800 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200',
};

export function DashboardShell({
  children,
  role,
  isAdmin,
  userLabel,
  isSchoolOwner = false,
  shellRole,
}: DashboardShellProps) {
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
    <main data-shell-role={shellRole} className="dashboard-shell min-h-dvh text-foreground">
      <div className="flex min-h-dvh flex-col">
        <header className="border-b border-border/70">
          <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-gutter">
            <Link
              href="/"
              aria-label={siteName}
              className="group flex min-w-0 items-center gap-2 text-foreground"
            >
              {/* biome-ignore lint/performance/noImgElement: static brand mark — same asset as SiteNav */}
              <img
                src="/brand/logo-black.svg"
                alt=""
                width={28}
                height={28}
                className="h-7 w-7 shrink-0"
              />
              <span className="site-header-wordmark truncate font-display text-base tracking-[-0.02em] text-foreground">
                {siteName}
              </span>
            </Link>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]',
                  BADGE_TINT[shellRole],
                )}
              >
                {t(`badge.${shellRole}`)}
              </span>
              <span className="hidden truncate text-xs font-medium text-muted-foreground sm:block">
                {hasAdminRole && shellRole !== 'admin' ? t('adminAccess') : userLabel}
              </span>
              <LocaleSwitcher />
            </div>
          </div>
        </header>

        <div className="mx-auto grid w-full max-w-7xl flex-1 gap-6 px-gutter py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="lg:border-r lg:border-border/70 lg:pr-6">
            <DashboardNav
              role={role}
              isAdmin={isAdmin}
              userLabel={userLabel}
              isSchoolOwner={isSchoolOwner}
            />
          </aside>

          <section className="min-w-0">
            <SignupConfirmationBanner />
            {children}
          </section>
        </div>
      </div>
    </main>
  );
}
