//
// Renders the role-correct tab (Student / Instructor / Handledare) + a
// sign-out button that fires better-auth's `signOut()` then
// `router.refresh()` so the root layout's `useIsAuthenticated` flips to
// false on the next SSR pass.
//
// Tab visibility is GATED STRICTLY BY `UserProfile.role`: a STUDENT sees
// only the student tab, an INSTRUCTOR only the instructor tab, a HANDLEDARE
// only the handledare tab. The handledare→trafiklärare upgrade flow lands
// a user on the handledare dashboard while their licence is still PENDING /
// REJECTED (the role-flip only runs on VERIFIED), so this component keeps
// the cohort honest — they don't see a Student / Instructor tab offering
// a competing view once they're a handledare (and vice versa). After the
// handledare→trafiklärare upgrade flips role to INSTRUCTOR, this nav
// hides the Handledare tab automatically.
//
// Admin does NOT auto-generate marketplace tabs. Owner-account testing
// sets `isAdmin=true` without flipping `UserProfile.role`, so an owner
// who picks STUDENT in the wizard would otherwise see the Instructor
// and Handledare tabs they don't actually hold. Admin keeps its badge
// (admin-only routes under `/dashboard/admin/*` are still reachable via
// direct URL or the admin badge surface).
//
// Kept as a 'use client' island because (a) the sign-out button needs
// better-auth's client API, (b) the role badge is reactive to a session
// change, and (c) we keep the static layout size minimal.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

export interface DashboardNavProps {
  role: 'STUDENT' | 'INSTRUCTOR' | 'HANDLEDARE';
  isAdmin: boolean;
  userLabel: string;
}

export function DashboardNav({ role, isAdmin, userLabel }: DashboardNavProps) {
  const router = useRouter();
  const t = useTranslations('dashboardNav');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.push('/');
      router.refresh();
    } catch {
      setSigningOut(false);
      toast.error(t('signOutError'));
    }
  }

  const showStudentTab = role === 'STUDENT';
  const showInstructorTab = role === 'INSTRUCTOR';
  const showHandledareTab = role === 'HANDLEDARE';

  return (
    <nav
      aria-label={t('ariaLabel')}
      className="dashboard-nav flex flex-wrap items-center gap-2 rounded-[calc(var(--radius)+0.25rem)] border border-border bg-card px-3 py-3 shadow-md"
    >
      <div className="flex items-center gap-2">
        {showStudentTab ? (
          <Link
            href="/dashboard/student"
            aria-current={role === 'STUDENT' ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-2 text-small font-semibold transition-colors',
              role === 'STUDENT'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t('studentTab')}
          </Link>
        ) : null}
        {showInstructorTab ? (
          <Link
            href="/dashboard/instructor"
            aria-current={role === 'INSTRUCTOR' ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-2 text-small font-semibold transition-colors',
              role === 'INSTRUCTOR'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t('instructorTab')}
          </Link>
        ) : null}
        {showHandledareTab ? (
          <Link
            href="/dashboard/handledare"
            aria-current={role === 'HANDLEDARE' ? 'page' : undefined}
            className={cn(
              'rounded-full px-3.5 py-2 text-small font-semibold transition-colors',
              role === 'HANDLEDARE'
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t('handledareTab')}
          </Link>
        ) : null}
        {role !== 'HANDLEDARE' ? (
          <Link
            href="/dashboard/messages"
            className="rounded-full px-3.5 py-2 text-small font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {t('messagesTab')}
          </Link>
        ) : null}
        {isAdmin ? (
          <span className="ml-1 rounded-md border border-brand-500/40 bg-brand-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.12em] text-brand-700 dark:bg-brand-900 dark:text-brand-300">
            {t('adminBadge')}
          </span>
        ) : null}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden text-small text-muted-foreground sm:inline">{userLabel}</span>
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
