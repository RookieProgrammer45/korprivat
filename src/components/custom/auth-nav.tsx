//
// Renders (logged-out) Sign in or (logged-in) avatar menu with Dashboard /
// Profile / Sign out from better-auth's `useSession`. We render nothing while
// the session is still resolving so we don't briefly flash the logged-out
// state to an actual returning user.
//
// Labels live in `common.nav.*` so the SV/EN switch flips them. Sign out
// clears the cookie then hard-navigates home so server chrome refreshes.
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { signOut, useSession } from '@/lib/auth-client';

function initialsFor(name: string | null | undefined, email: string | null | undefined): string {
  const fromName = name
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  if (fromName) return fromName;
  const fromEmail = email?.[0]?.toUpperCase();
  return fromEmail || '?';
}

export function AuthNav() {
  const t = useTranslations('common');
  const { data: session, isPending } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  if (isPending) return null;

  if (!session?.user) {
    return (
      <nav className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="rounded-full border border-border bg-card text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900"
        >
          <Link href="/login">{t('nav.signIn')}</Link>
        </Button>
      </nav>
    );
  }

  const label = session.user.name?.trim() || session.user.email || t('nav.profile');

  return (
    <nav className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 rounded-full border border-border bg-card px-1.5 pr-2.5 text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900"
            aria-label={label}
          >
            <Avatar className="size-7">
              <AvatarImage src={session.user.image ?? undefined} alt="" />
              <AvatarFallback className="text-[0.65rem] font-medium">
                {initialsFor(session.user.name, session.user.email)}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-[9rem] truncate text-xs font-medium sm:inline">
              {label}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[12rem]">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col gap-0.5">
              {session.user.name ? (
                <span className="truncate text-sm font-medium text-foreground">
                  {session.user.name}
                </span>
              ) : null}
              {session.user.email ? (
                <span className="truncate text-xs text-muted-foreground">{session.user.email}</span>
              ) : null}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/dashboard">{t('nav.dashboard')}</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/profile">{t('nav.profile')}</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={signingOut}
            onSelect={async (event) => {
              event.preventDefault();
              setSigningOut(true);
              try {
                await signOut();
                window.location.assign('/');
              } catch {
                setSigningOut(false);
                toast.error(t('nav.signOutError'));
              }
            }}
          >
            {signingOut ? t('nav.signingOut') : t('nav.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
