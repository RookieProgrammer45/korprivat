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
import { clearPersistedAuthNext, sanitizeNext } from '@/lib/auth-next';
import { PostLoginRedirect, RoleEnum } from '@/lib/contracts/auth';
import { isIndependentInstructorSignupOpen } from '@/lib/signup-eligibility';

export default function OAuthCompletePage() {
  const router = useRouter();
  const t = useTranslations('auth');
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = new URLSearchParams(window.location.search);
    const parsedRole = RoleEnum.safeParse(params.get('role') ?? 'STUDENT');
    const incoming = parsedRole.success ? parsedRole.data : 'STUDENT';
    const role =
      incoming === 'INSTRUCTOR' && !isIndependentInstructorSignupOpen() ? 'STUDENT' : incoming;
    const next = sanitizeNext(params.get('next'));

    void (async () => {
      try {
        await apiFetch('/api/auth/social-role', {
          method: 'POST',
          body: JSON.stringify({ role, ...(next ? { next } : {}) }),
          schema: PostLoginRedirect,
        });
        // Prefer an explicit same-origin `next` (e.g. school signup → /for-skolor).
        // Learners go to the dashboard. The verify page is only a claimed-DOB
        // form now; instructors resume the signup wizard.
        if (next) {
          clearPersistedAuthNext();
          router.replace(next);
        } else if (incoming === 'INSTRUCTOR') {
          router.replace('/signup?role=school');
        } else if (role === 'STUDENT') {
          router.replace('/dashboard/student');
        } else {
          router.replace('/signup?role=school');
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
