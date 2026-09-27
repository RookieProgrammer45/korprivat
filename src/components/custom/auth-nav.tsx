//
// Renders (logged-out) Sign in / Sign up or (logged-in) Profile / Sign out
// from better-auth's `useSession`. We render nothing while the session is
// still resolving so we don't briefly flash the logged-out state to an
// actual returning user — better-auth's cookie round trips faster than
// React's first commit.
//
// Labels live in `common.nav.*` so the SAME/EN switch flips them. The
// Sign out button calls signOut + a soft reload to ensure server state
// (gated server components, the per-request CSP nonce, etc.) refreshes
// after the cookie clears.
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';

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

  return (
    <nav className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={signingOut}
        aria-busy={signingOut}
        onClick={async () => {
          setSigningOut(true);
          try {
            await signOut();
            window.location.assign('/');
          } catch {
            setSigningOut(false);
            toast.error(t('nav.signOutError'));
          }
        }}
        className="rounded-full border border-border bg-card text-muted-foreground hover:border-brand-400 hover:bg-brand-100 hover:text-foreground dark:hover:bg-brand-900"
      >
        {signingOut ? t('nav.signingOut') : t('nav.signOut')}
      </Button>
    </nav>
  );
}
