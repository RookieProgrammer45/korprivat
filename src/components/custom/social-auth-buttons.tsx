'use client';

// Google OAuth entry for /signup and /login.
//
// Signup carries the marketplace role in the OAuth callbackURL so
// /oauth-complete can POST /api/auth/social-role after the provider
// exchange. Login skips that hop — callbackURL is the dashboard (or
// ?next=…) so an existing UserProfile.role is never overwritten.

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Role } from '@/lib/contracts/auth';
import { signIn } from '@/lib/auth-client';

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function SocialAuthButtons({
  mode,
  role = 'STUDENT',
  next,
}: {
  mode: 'signup' | 'login';
  /** Marketplace role seeded after OAuth on signup only. */
  role?: Role;
  next?: string;
}) {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);

  const startGoogle = async () => {
    setPending(true);
    const callbackURL =
      mode === 'signup'
        ? `/oauth-complete?role=${encodeURIComponent(role)}${
            next ? `&next=${encodeURIComponent(next)}` : ''
          }`
        : (next ?? '/dashboard');

    try {
      // disableRedirect so we own navigation — avoids hanging when the
      // fetch-follow of Google's authorize URL fails in some browsers.
      const { data, error } = await signIn.social({
        provider: 'google',
        callbackURL,
        errorCallbackURL: mode === 'signup' ? '/signup' : '/login',
        disableRedirect: true,
      });

      if (error || !data?.url) {
        toast.error(t('social.error'));
        setPending(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      toast.error(t('social.error'));
      setPending(false);
    }
  };

  return (
    <div className="grid gap-4">
      <button
        type="button"
        disabled={pending}
        onClick={() => void startGoogle()}
        className="auth-submit inline-flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius)] border border-border bg-white px-4 text-base font-semibold text-foreground shadow-none transition-colors hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-50 dark:bg-card"
      >
        <GoogleMark className="shrink-0" />
        {t('social.google')}
      </button>
      <div className="flex items-center gap-3" role="separator" aria-label={t('divider.or')}>
        <span className="h-px flex-1 bg-border" />
        <span className="text-caption uppercase tracking-wide text-muted-foreground">
          {t('divider.or')}
        </span>
        <span className="h-px flex-1 bg-border" />
      </div>
    </div>
  );
}
