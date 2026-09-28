'use client';

// Post-OAuth landing for Google signup.
//
// better-auth finishes the provider exchange and redirects here with
// ?role=STUDENT|INSTRUCTOR (and optional ?next=) in the callbackURL set by
// <SocialAuthButtons>. We POST /api/auth/social-role to commit the
// marketplace role (idempotent via welcomeSentAt), then route learners to
// ID verification and instructors back into the signup wizard.
//
// Login does not use this page — its callbackURL is /dashboard (or ?next=)
// so existing roles are never overwritten.

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { AuthShell } from '@/components/custom/auth-shell';
import { apiFetch } from '@/lib/api-client';
import { PostLoginRedirect, RoleEnum } from '@/lib/contracts/auth';

function sanitizeNext(raw: string | null): string | undefined {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return undefined;
  return raw;
}

export default function OAuthCompletePage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const parsedRole = RoleEnum.safeParse(params.get('role') ?? 'STUDENT');
    const role = parsedRole.success ? parsedRole.data : 'STUDENT';
    const next = sanitizeNext(params.get('next'));

    void (async () => {
      try {
        await apiFetch('/api/auth/social-role', {
          method: 'POST',
          body: JSON.stringify({ role, ...(next ? { next } : {}) }),
          schema: PostLoginRedirect,
        });
        // Prefer an explicit same-origin `next` (e.g. school signup → /for-skolor).
        // Otherwise learners go to Didit; instructors resume the signup wizard.
        if (next) {
          router.replace(next);
        } else if (role === 'STUDENT') {
          router.replace('/onboarding/learner/verify');
        } else {
          router.replace('/signup?role=instructor');
        }
        router.refresh();
      } catch {
        toast.error(t('social.error'));
        router.replace('/signup');
      }
    })();
  }, [router, t]);

  return (
    <AuthShell>
      <p className="text-body text-muted-foreground" aria-live="polite">
        …
      </p>
    </AuthShell>
  );
}
