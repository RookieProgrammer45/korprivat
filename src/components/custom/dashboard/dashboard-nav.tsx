// @polsia:user-owned
'use client';

import { LayoutDashboard } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import type { MarketplaceRole } from '@/lib/contracts/clickwrap';
import { cn } from '@/lib/utils';

export interface DashboardNavProps {
  role: MarketplaceRole;
  isAdmin: boolean;
  userLabel: string;
}

export function DashboardNav({ role, isAdmin, userLabel }: DashboardNavProps) {
  const pathname = usePathname();
  const t = useTranslations('dashboard.nav');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      window.location.assign('/');
    } catch {
      setSigningOut(false);
      toast.error(t('signOutError'));
    }
  }

  const navItems = [
    ...(role === 'INSTRUCTOR' || role === 'HANDLEDARE'
      ? [{ href: '/dashboard', label: t('overviewTab'), icon: LayoutDashboard }]
      : []),
    ...(role === 'STUDENT'
      ? [{ href: '/dashboard/student', label: t('studentTab'), icon: LayoutDashboard }]
      : []),
    ...(role === 'INSTRUCTOR'
      ? [{ href: '/dashboard/instructor', label: t('instructorTab'), icon: LayoutDashboard }]
      : []),
    ...(role === 'HANDLEDARE'
      ? [{ href: '/dashboard/handledare', label: t('handledareTab'), icon: LayoutDashboard }]
      : []),
    ...(role === 'INSTRUCTOR'
      ? [
          {
            href: '/dashboard/instructor/availability',
            label: t('availabilityTab'),
            icon: LayoutDashboard,
          },
        ]
      : []),
    ...(role === 'HANDLEDARE'
      ? [
          {
            href: '/dashboard/handledare/availability',
            label: t('availabilityTab'),
            icon: LayoutDashboard,
          },
        ]
      : []),
    ...(role !== 'HANDLEDARE'
      ? [{ href: '/dashboard/messages', label: t('messagesTab'), icon: LayoutDashboard }]
      : []),
  ];

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="flex flex-wrap items-center gap-2 rounded-[calc(var(--radius)+0.25rem)] border border-border bg-card px-3 py-3 shadow-md lg:grid lg:overflow-visible"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-full px-3 text-sm font-medium transition-colors',
              active
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
      {isAdmin ? (
        <span className="rounded-md border border-brand-500/40 bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700 dark:bg-brand-900 dark:text-brand-300">
          {t('adminBadge')}
        </span>
      ) : null}
      <div className="ml-auto flex w-full items-center gap-2 lg:ml-0 lg:w-auto lg:flex-col lg:items-stretch">
        <span className="hidden truncate text-xs text-muted-foreground xl:block">{userLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-busy={signingOut}
          className="rounded-full border border-border bg-background text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900"
        >
          {signingOut ? t('signingOut') : t('signOut')}
        </Button>
      </div>
    </nav>
  );
}
